"""Offline contract tests; all tokens/configs are synthetic."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'examples' / 'tsinghua-cloud-drive' / 'scripts'))
import drive

BASE = 'https://cloud.tsinghua.edu.cn'
REPO = '00000000-0000-4000-8000-000000000001'
TOKEN = 'a' * 40


class Response:
    def __init__(self, data=None, status=200, content=b''):
        self.data, self.status_code, self.content = data, status, content
        self.headers = {}
    def json(self):
        if isinstance(self.data, Exception):
            raise self.data
        return self.data
    def iter_content(self, chunk_size):
        yield self.content
    def close(self):
        pass


class FakeHTTP:
    def __init__(self):
        self.calls = []
        self.entries = {'/': None, '/folder': None, '/hello.txt': b'hello'}
        self.hook = None
    def request(self, method, url, **kw):
        self.calls.append((method, url, kw))
        assert kw['allow_redirects'] is False and kw['verify'] is True
        if self.hook:
            response = self.hook(method, url, kw)
            if response is not None:
                return response
        endpoint = url.split('/via-repo-token/')[-1]
        path = kw.get('params', {}).get('path')
        if endpoint == 'repo-info/':
            return Response({'repo_id': REPO, 'owner': 'private@example.org'})
        if endpoint == 'dir/' and method == 'GET':
            if path not in self.entries or self.entries[path] is not None:
                return Response({}, 404)
            items = []
            for p, content in self.entries.items():
                if p != '/' and p.rsplit('/', 1)[0] == path.rstrip('/'):
                    item = {'name': p.rsplit('/', 1)[1], 'type': 'dir' if content is None else 'file', 'modifier_email': 'private@example.org'}
                    if content is not None:
                        item['size'] = len(content)
                    items.append(item)
            return Response({'user_perm': 'rw', 'dirent_list': items})
        if endpoint == 'upload-link/' and method == 'GET':
            return Response(BASE + '/seafhttp/upload-api/fake-capability')
        if '/seafhttp/upload-api/' in url:
            fields = kw['data'].fields
            name, source, mime = fields['file']
            target = fields['parent_dir'].rstrip('/') + '/' + name
            content = source.read()
            self.entries[target] = content
            return Response([{'name': name, 'size': len(content)}])
        if endpoint == 'download-link/' and method == 'GET':
            return Response(BASE + '/seafhttp/files/fake-capability' + path)
        if '/seafhttp/files/fake-capability' in url:
            path = url.split('/seafhttp/files/fake-capability')[1]
            return Response(content=self.entries[path])
        if endpoint == 'dir/' and method == 'POST':
            data = kw.get('json', kw.get('data'))
            if data['operation'] == 'mkdir':
                self.entries[path] = None
                return Response({'type': 'dir', 'obj_name': path.rsplit('/', 1)[1], 'parent_dir': path.rsplit('/', 1)[0] or '/'})
        if method == 'POST' and endpoint in ('dir/', 'file/'):
            data = kw.get('json', kw.get('data'))
            if data.get('operation') == 'rename':
                target = (path.rsplit('/', 1)[0] or '') + '/' + data['newname']
                kind = 'dir' if self.entries[path] is None else 'file'
                for p in list(self.entries):
                    if p == path or p.startswith(path + '/'):
                        self.entries[target + p[len(path):]] = self.entries.pop(p)
                return Response({'type': kind, 'obj_name': data['newname']})
        if endpoint == 'sync-batch-move-item/' and method == 'POST':
            data = kw['json']
            assert len(data['src_dirents']) == 1
            source = data['src_parent_dir'].rstrip('/') + '/' + data['src_dirents'][0]
            target = data['dst_parent_dir'].rstrip('/') + '/' + data['src_dirents'][0]
            for p in list(self.entries):
                if p == source or p.startswith(source + '/'):
                    self.entries[target + p[len(source):]] = self.entries.pop(p)
            return Response({'success': True})
        if method == 'DELETE' and endpoint in ('file/', 'dir/'):
            for p in list(self.entries):
                if p == path or p.startswith(path + '/'):
                    del self.entries[p]
            return Response({'success': True})
        raise AssertionError('Unexpected fake request')


class Tests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(drive, 'drive module must exist')
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.config = self.root / 'credentials.json'
        self.config.write_text(json.dumps({'base_url': BASE, 'repo_id': REPO, 'api_token': TOKEN}))
        self.config.chmod(0o600)
        self.http = FakeHTTP()
        self.cloud = drive.Cloud(self.config, session=self.http)

    def test_environment_credentials_without_config_file(self):
        with patch.dict(os.environ, {'TSINGHUA_CLOUD_TOKEN': TOKEN, 'TSINGHUA_CLOUD_REPO_ID': REPO}, clear=True), patch.object(Path, 'open', side_effect=AssertionError('Environment mode must not read config')):
            cloud = drive.Cloud(session=self.http)
            self.assertEqual(cloud.stat('/hello.txt')['size'], 5)
        with patch.dict(os.environ, {'TSINGHUA_CLOUD_TOKEN': TOKEN, 'TSINGHUA_CLOUD_REPO_ID': REPO}, clear=True):
            cloud = drive.Cloud(session=self.http)
            source = self.root / 'env-upload.txt'
            source.write_text('ok')
            self.assertEqual(cloud.upload(source, '/env-upload.txt')['size'], 2)
        with patch.dict(os.environ, {'TSINGHUA_CLOUD_TOKEN': TOKEN}, clear=True):
            with self.assertRaises(drive.CloudError):
                drive.Cloud(session=self.http)

    def test_config_list_stat_private_scope(self):
        self.assertEqual(self.cloud.stat('/hello.txt'), {'path': '/hello.txt', 'name': 'hello.txt', 'type': 'file', 'size': 5})
        self.assertEqual(self.cloud.stat('/folder')['type'], 'dir')
        self.assertIsNone(self.cloud.stat('/missing'))
        self.assertEqual(self.cloud.stat('/')['type'], 'dir')
        self.assertNotIn('private@example.org', json.dumps(self.cloud.list('/')))
        self.assertTrue(all(c[2]['headers']['Authorization'] == 'Bearer ' + TOKEN for c in self.http.calls))

    def test_config_rejects_bad_scope_and_permissions(self):
        for key, value in [('base_url', 'http://cloud.tsinghua.edu.cn'), ('repo_id', 'bad'), ('api_token', 'secret')]:
            data = {'base_url': BASE, 'repo_id': REPO, 'api_token': TOKEN}
            data[key] = value
            self.config.write_text(json.dumps(data))
            with self.assertRaises(drive.CloudError):
                drive.Cloud(self.config, session=self.http)
        self.config.chmod(0o644)
        with self.assertRaises(drive.CloudError):
            drive.Cloud(self.config, session=self.http)

    def test_every_mutation_validates_paths_before_http(self):
        bad_paths = ['/a/../b', '/a\\b', '//a', '/a/', '/a\n', '/a/./b']
        for path in bad_paths:
            actions = [lambda: self.cloud.mkdir(path, parents=True),
                       lambda: self.cloud.upload(self.config, path),
                       lambda: self.cloud.write(path, text='x'),
                       lambda: self.cloud.rename(path, 'x'),
                       lambda: self.cloud.move(path, '/folder'),
                       lambda: self.cloud.move('/hello.txt', path),
                       lambda: self.cloud.delete(path, yes=True, recursive=True)]
            for action in actions:
                before = len(self.http.calls)
                with self.assertRaises(drive.CloudError):
                    action()
                self.assertEqual(len(self.http.calls), before)
        for name in ['', '..', 'a/b', 'a\\b', 'a\n']:
            before = len(self.http.calls)
            with self.assertRaises(drive.CloudError):
                self.cloud.rename('/hello.txt', name)
            self.assertEqual(len(self.http.calls), before)

    def test_mutations_never_retry_on_transport_uncertainty(self):
        def fail(method, url, kw):
            if method != 'GET':
                raise drive.requests.ConnectionError(TOKEN)
        self.http.hook = fail
        for action in [lambda: self.cloud.mkdir('/new'), lambda: self.cloud.rename('/hello.txt', 'new'),
                       lambda: self.cloud.move('/hello.txt', '/folder'), lambda: self.cloud.delete('/hello.txt', yes=True)]:
            before = len(self.http.calls)
            with self.assertRaisesRegex(drive.CloudError, 'Ambiguous'):
                action()
            self.assertEqual(sum(c[0] != 'GET' for c in self.http.calls[before:]), 1)

    def test_stream_error_and_oversize_do_not_publish(self):
        class BrokenResponse(Response):
            def iter_content(self, chunk_size):
                yield b'he'
                raise drive.requests.ConnectionError(TOKEN)
        for response in [BrokenResponse(), Response(content=b'way too long')]:
            self.http.hook = lambda m, u, k: response if '/seafhttp/files/' in u else None
            with self.assertRaises(drive.CloudError) as error:
                self.cloud.download('/hello.txt', self.root / 'failed')
            self.assertNotIn(TOKEN, str(error.exception))
            self.assertFalse((self.root / 'failed').exists())
            self.assertFalse(list(self.root.glob('.cloud-download-*')))

    def test_upload_requires_real_readback_and_hash_match(self):
        source = self.root / 'source'
        source.write_bytes(b'abc')
        self.http.hook = lambda m, u, k: Response([{'name': 'missing', 'size': 3}]) if m == 'POST' else None
        with self.assertRaises(drive.CloudError):
            self.cloud.upload(source, '/missing')
        self.http.hook = lambda m, u, k: Response(content=b'bad') if '/seafhttp/files/' in u else None
        with self.assertRaisesRegex(drive.CloudError, 'SHA256'):
            self.cloud.upload(source, '/new', verify='sha256')

    def test_config_scope_response_symlink_and_precedence(self):
        self.http.hook = lambda m, u, k: Response({'repo_id': 'wrong'})
        with self.assertRaises(drive.CloudError):
            drive.Cloud(self.config, session=self.http)
        alias = self.root / 'symlink'
        alias.symlink_to(self.config)
        with self.assertRaises(drive.CloudError):
            drive.Cloud(alias, session=FakeHTTP())
        with patch.dict(os.environ, {'TSINGHUA_CLOUD_CONFIG': str(self.root / 'missing')}):
            self.assertEqual(drive.Cloud(self.config, session=FakeHTTP()).repo_id, REPO)
        self.config.write_text('{not JSON ' + TOKEN)
        with self.assertRaises(drive.CloudError) as error:
            drive.Cloud(self.config, session=FakeHTTP())
        self.assertNotIn(TOKEN, str(error.exception))

    def test_nonregular_upload_refused_before_open(self):
        with patch.object(Path, 'open', side_effect=AssertionError('Must reject directory before opening')):
            with self.assertRaises(drive.CloudError):
                self.cloud.upload(self.root, '/bad')

    def test_real_cli_all_commands_and_safe_failures(self):
        self.assertTrue(hasattr(drive, 'main'), 'CLI slice missing')
        local = self.root / 'source'
        local.write_text('payload', encoding='utf-8')
        invocations = [
            ['list', '/'], ['stat', '/hello.txt'], ['search', '--path', '/', '--name', 'hello', '--recursive', '--max-items', '1'],
            ['mkdir', '/new/deep', '--parents'], ['upload', str(local), '--path', '/upload'],
            ['download', '/hello.txt', '--output', str(self.root / 'download')], ['read', '/hello.txt'],
            ['write', '/new', '--text', '新内容'], ['write', '/new', '--file', str(local)],
            ['rename', '/hello.txt', '--name', 'new'], ['move', '/hello.txt', '--to-dir', '/folder'],
            ['delete', '/hello.txt', '--yes'],
        ]
        driver = "import sys,runpy,requests,test_drive; requests.Session=test_drive.FakeHTTP; sys.argv=['drive.py']+sys.argv[1:]; runpy.run_path(test_drive.drive.__file__,run_name='__main__')"
        for args in invocations + [['stat', '/missing'], ['delete', '/'], ['--bad-option', TOKEN]]:
            proc = subprocess.run([sys.executable, '-B', '-c', driver, '--config', str(self.config)] + args,
                                  cwd=Path(__file__).parent, text=True, capture_output=True)
            self.assertNotIn(TOKEN, proc.stdout + proc.stderr)
            result = json.loads(proc.stdout)
            self.assertEqual(proc.returncode, 0 if args in invocations else 1, (args, result, proc.stderr))
            self.assertEqual(proc.stderr, '')
        with patch.dict(os.environ, {'TSINGHUA_CLOUD_CONFIG': str(self.config)}):
            self.assertEqual(drive.Cloud(session=FakeHTTP()).repo_id, REPO)

    def test_rename_move_file_directory_and_readback(self):
        self.assertTrue(hasattr(self.cloud, 'move'), 'mutation slice missing')
        self.cloud.rename('/hello.txt', 'renamed.txt')
        self.cloud.move('/renamed.txt', '/folder')
        self.assertNotIn('/renamed.txt', self.http.entries)
        self.assertEqual(self.http.entries['/folder/renamed.txt'], b'hello')
        self.cloud.rename('/folder', 'renamed-folder')
        self.cloud.mkdir('/destination')
        self.cloud.move('/renamed-folder', '/destination')
        self.assertEqual(self.http.entries['/destination/renamed-folder/renamed.txt'], b'hello')
        moves = [c for c in self.http.calls if 'sync-batch-move-item/' in c[1]]
        self.assertEqual(moves[-1][2]['json'], {'src_parent_dir': '/', 'dst_parent_dir': '/destination', 'src_dirents': ['renamed-folder']})

    def test_no_merge_overlap_delete_gate_and_absence(self):
        self.assertTrue(hasattr(self.cloud, 'delete'), 'mutation slice missing')
        self.http.entries['/folder/inside'] = b'one'
        for action in [lambda: self.cloud.delete('/folder', yes=True), lambda: self.cloud.delete('/hello.txt'),
                       lambda: self.cloud.delete('/', yes=True, recursive=True),
                       lambda: self.cloud.move('/folder', '/folder'),
                       lambda: self.cloud.rename('/hello.txt', 'folder')]:
            before = len(self.http.calls)
            with self.assertRaises(drive.CloudError):
                action()
            self.assertFalse(any(c[0] != 'GET' for c in self.http.calls[before:]))
        self.cloud.delete('/folder', yes=True, recursive=True)
        self.assertNotIn('/folder', self.http.entries)
        self.cloud.delete('/hello.txt', yes=True)
        self.assertNotIn('/hello.txt', self.http.entries)
        self.cloud.mkdir('/empty')
        self.cloud.delete('/empty', yes=True)

    def test_mutation_response_and_readback_both_required(self):
        self.assertTrue(hasattr(self.cloud, 'delete'), 'mutation slice missing')
        for data in [{'success': False}, {'success': True}, {'error': TOKEN}]:
            self.http.hook = lambda m, u, k: Response(data) if m == 'DELETE' else None
            with self.assertRaises(drive.CloudError):
                self.cloud.delete('/hello.txt', yes=True)
        self.http.hook = lambda m, u, k: Response({'type': 'file', 'obj_name': 'renamed'}) if m == 'POST' else None
        with self.assertRaises(drive.CloudError):
            self.cloud.rename('/hello.txt', 'renamed')
        self.http.hook = lambda m, u, k: Response({'success': True}) if m == 'POST' else None
        with self.assertRaises(drive.CloudError):
            self.cloud.move('/hello.txt', '/folder')

    def test_upload_default_size_duplicate_and_explicit_sha(self):
        self.assertTrue(hasattr(self.cloud, 'upload'), 'upload slice missing')
        local = self.root / 'source'
        local.write_bytes(b'content')
        with patch.object(drive.hashlib, 'sha256', side_effect=AssertionError('default must not hash')):
            result = self.cloud.upload(local, '/new.txt')
        self.assertEqual(result['verification'], 'size')
        before = len(self.http.calls)
        with self.assertRaises(drive.CloudError):
            self.cloud.upload(local, '/new.txt')
        self.assertFalse(any(c[0] == 'POST' for c in self.http.calls[before:]))
        result = self.cloud.upload(local, '/new.txt', overwrite=True, verify='sha256')
        import hashlib
        self.assertEqual(result['sha256'], hashlib.sha256(b'content').hexdigest())
        replace = [c[2]['params']['replace'] for c in self.http.calls if 'upload-link/' in c[1]]
        self.assertEqual(replace, ['0', '1'])

    def test_write_text_file_and_credential_guards(self):
        self.assertTrue(hasattr(self.cloud, 'write'), 'write slice missing')
        self.assertEqual(self.cloud.write('/text', text='你好')['size'], len('你好'.encode()))
        self.assertEqual(self.cloud.read('/text')['text'], '你好')
        with self.assertRaises(drive.CloudError):
            self.cloud.write('/text', text='same size')
        self.cloud.write('/text', text='', overwrite=True)
        source = self.root / 'source'
        source.write_bytes(b'via file')
        self.cloud.write('/file', file=source)
        self.assertEqual(self.http.entries['/file'], b'via file')
        for source in [self.config, self.root / 'alias']:
            if source != self.config:
                os.link(self.config, source)
            with self.assertRaises(drive.CloudError):
                self.cloud.upload(source, '/leak')
        with self.assertRaises(drive.CloudError):
            self.cloud.write('/bad', text='a', file=self.config)
        with patch.object(drive, 'MAX_UPLOAD', 1):
            with self.assertRaisesRegex(drive.CloudError, '10GB'):
                self.cloud.upload(self.root / 'source', '/large')

    def test_upload_unknown_network_no_resend_bad_response_no_success(self):
        self.assertTrue(hasattr(self.cloud, 'upload'), 'upload slice missing')
        source = self.root / 'source'
        source.write_bytes(b'abc')
        def fail(method, url, kw):
            if method == 'POST':
                raise drive.requests.Timeout(TOKEN + ' ' + BASE + '/cap-secret')
        self.http.hook = fail
        with self.assertRaisesRegex(drive.CloudError, 'Ambiguous') as error:
            self.cloud.upload(source, '/uncertain')
        self.assertNotIn(TOKEN, str(error.exception))
        self.assertEqual(sum(c[0] == 'POST' for c in self.http.calls), 1)
        for response in [Response({'error': TOKEN}), Response([{'name': 'wrong', 'size': 3}]), Response({}, 500)]:
            self.http.hook = lambda m, u, k: response if m == 'POST' else None
            with self.assertRaises(drive.CloudError):
                self.cloud.upload(source, '/invalid')
        self.assertNotIn('/invalid', self.http.entries)

    def test_read_download_limits_and_atomic_failure(self):
        self.assertTrue(hasattr(self.cloud, 'read'), 'read slice missing')
        self.assertEqual(self.cloud.read('/hello.txt')['text'], 'hello')
        with self.assertRaises(drive.CloudError):
            self.cloud.read('/hello.txt', max_bytes=4)
        self.http.entries['/binary'] = b'\xff'
        with self.assertRaises(drive.CloudError):
            self.cloud.read('/binary')
        output = self.root / 'out'
        with patch.object(drive.hashlib, 'sha256', side_effect=AssertionError('default must not hash')):
            self.cloud.download('/hello.txt', output)
        self.assertEqual(output.read_bytes(), b'hello')
        with self.assertRaises(drive.CloudError):
            self.cloud.download('/hello.txt', output)
        self.http.hook = lambda m, u, k: Response(content=b'short') if '/seafhttp/' in u else None
        self.http.entries['/hello.txt'] = b'longer-content'
        with self.assertRaises(drive.CloudError):
            self.cloud.download('/hello.txt', output, overwrite=True)
        self.assertEqual(output.read_bytes(), b'hello')
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ['credentials.json', 'out'])
        for method, url, kw in self.http.calls:
            if '/seafhttp/' in url:
                self.assertNotIn('Authorization', kw['headers'])

    def test_capability_origin_redirect_and_json_errors(self):
        self.assertTrue(hasattr(self.cloud, 'read'), 'read slice missing')
        for url in ['https://evil.example/secret', 'http://cloud.tsinghua.edu.cn/x', BASE + ':444/x', 'https://user@cloud.tsinghua.edu.cn/x']:
            self.http.hook = lambda m, u, k: Response(url) if 'download-link/' in u else None
            before = len(self.http.calls)
            with self.assertRaises(drive.CloudError) as error:
                self.cloud.read('/hello.txt')
            self.assertNotIn(url, str(error.exception))
            self.assertFalse(any('/seafhttp/' in c[1] for c in self.http.calls[before:]))
        self.http.hook = lambda m, u, k: Response(status=302)
        with self.assertRaises(drive.CloudError):
            self.cloud.list('/')
        self.http.hook = lambda m, u, k: Response(ValueError(TOKEN))
        with self.assertRaises(drive.CloudError) as error:
            self.cloud.list('/')
        self.assertNotIn(TOKEN, str(error.exception))

    def test_search_and_mkdir_parents(self):
        self.assertTrue(hasattr(self.cloud, 'mkdir'), 'mkdir slice missing')
        result = self.cloud.mkdir('/new/deep', parents=True)
        self.assertEqual(result['path'], '/new/deep')
        self.assertEqual(self.cloud.mkdir('/new/deep', parents=True), result)
        with self.assertRaises(drive.CloudError):
            self.cloud.mkdir('/new/deep')
        self.http.entries['/new/deep/needle.txt'] = b'x'
        found = self.cloud.search('/', 'needle', recursive=True, max_items=100)
        self.assertEqual([i['path'] for i in found['items']], ['/new/deep/needle.txt'])
        self.assertFalse(found['truncated'])
        limited = self.cloud.search('/', 'not-found', recursive=True, max_items=1)
        self.assertTrue(limited['truncated'])
        self.assertEqual(limited['scanned'], 1)
        self.assertEqual(self.cloud.search('/', 'needle')['items'], [])
        with self.assertRaises(drive.CloudError):
            self.cloud.search('/', '', max_items=0)

    def test_mkdir_bad_response_never_success(self):
        self.assertTrue(hasattr(self.cloud, 'mkdir'), 'mkdir slice missing')
        self.http.hook = lambda m, u, k: Response({'error': TOKEN}) if m == 'POST' else None
        with self.assertRaises(drive.CloudError):
            self.cloud.mkdir('/new')
        self.assertNotIn('/new', self.http.entries)

    def test_paths_rejected_before_requests(self):
        for path in ['relative', '/a/../b', '/a\\b', '//a', '/a/', '/a\x00b', '/a/./b', '/a\x7fb']:
            before = len(self.http.calls)
            with self.assertRaises(drive.CloudError):
                self.cloud.list(path)
            self.assertEqual(before, len(self.http.calls))


if __name__ == '__main__':
    unittest.main()
