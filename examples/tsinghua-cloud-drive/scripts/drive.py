"""Single-library Seafile CLI. Destructive flags are NOT user authorization.

Caller must obtain explicit authorization before deletion or overwrite. No
mutation retries, chunked upload, public shares, or account-wide discovery.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import stat as statmod
import tempfile
from urllib.parse import urlsplit
import uuid

import requests
from requests_toolbelt.multipart.encoder import MultipartEncoder

BASE = 'https://cloud.tsinghua.edu.cn'
PREFIX = '/api/v2.1/via-repo-token/'
MAX_UPLOAD = 10_000_000_000


class CloudError(Exception):
    """Safe, fixed-message error; never carries upstream text or URLs."""


def remote_path(path):
    if (not isinstance(path, str) or not path.startswith('/') or '\\' in path
            or any(ord(c) < 32 or 127 <= ord(c) < 160 for c in path)
            or (path != '/' and any(p in ('', '.', '..') for p in path[1:].split('/')))):
        raise CloudError('Invalid absolute remote path')
    return path


def basename(name):
    if not isinstance(name, str) or '/' in name:
        raise CloudError('Invalid basename')
    remote_path('/' + name)
    if not name:
        raise CloudError('Invalid basename')
    return name


def safe_url(url):
    try:
        u = urlsplit(url)
        valid = (isinstance(url, str) and u.scheme == 'https' and u.hostname == 'cloud.tsinghua.edu.cn'
                 and u.port in (None, 443) and not u.username and not u.password and not u.fragment
                 and not any(ord(c) < 33 or ord(c) == 127 for c in url) and '\\' not in url)
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise CloudError('Capability URL origin rejected')
    return url


def load_config(config=None):
    if config is None and ('TSINGHUA_CLOUD_TOKEN' in os.environ or 'TSINGHUA_CLOUD_REPO_ID' in os.environ):
        token = os.environ.get('TSINGHUA_CLOUD_TOKEN', '')
        repo = os.environ.get('TSINGHUA_CLOUD_REPO_ID', '')
        if not re.fullmatch(r'[0-9a-fA-F]{40}', token) or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', repo):
            raise CloudError('Set both TSINGHUA_CLOUD_TOKEN and TSINGHUA_CLOUD_REPO_ID correctly')
        return None, {'base_url': BASE, 'repo_id': repo, 'api_token': token}
    path = Path(config or os.environ.get('TSINGHUA_CLOUD_CONFIG') or
                Path.home() / '.config/tsinghua-cloud-drive/credentials.json').expanduser()
    try:
        if path.is_symlink():
            raise CloudError('Credential symlink refused')
        with path.open('r', encoding='utf-8') as f:
            info = os.fstat(f.fileno())
            if not statmod.S_ISREG(info.st_mode) or (os.name == 'posix' and statmod.S_IMODE(info.st_mode) != 0o600):
                raise CloudError('Credential file must be regular and mode 0600 on POSIX')
            data = json.load(f)
        if (not isinstance(data, dict) or data.get('base_url') != BASE
                or not isinstance(data.get('repo_id'), str)
                or not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', data['repo_id'])
                or not isinstance(data.get('api_token'), str)
                or not re.fullmatch(r'[0-9a-fA-F]{40}', data['api_token'])):
            raise CloudError('Invalid credential schema or scope')
        uuid.UUID(data['repo_id'])
        return path.resolve(), data
    except CloudError:
        raise
    except (OSError, ValueError, TypeError):
        raise CloudError('Cannot load private credential configuration') from None


class Cloud:
    def __init__(self, config=None, *, session=None):
        self.config_path, data = load_config(config)
        self.repo_id, self._token = data['repo_id'], data['api_token']
        self.s = session if session is not None else requests.Session()
        self.s.trust_env = False  # Do not inherit proxies, netrc, or TLS overrides.
        info = self._api('GET', 'repo-info/')
        if not isinstance(info, dict) or info.get('repo_id') != self.repo_id:
            raise CloudError('Repository scope mismatch')

    def _request(self, method, url, *, auth=True, **kwargs):
        safe_url(url)
        headers = kwargs.pop('headers', {})
        if auth:
            headers['Authorization'] = 'Bearer ' + self._token
        try:
            response = self.s.request(method, url, headers=headers, timeout=(15, 180),
                                      allow_redirects=False, verify=True, **kwargs)
        except requests.RequestException:
            raise CloudError('Ambiguous mutation; inspect remote state before retry' if method != 'GET'
                             else 'Network read failed') from None
        if response.status_code not in (200, 201, 404):
            response.close()
            raise CloudError('Ambiguous mutation HTTP failure; inspect remote state before retry' if method != 'GET'
                             else 'HTTP read failed')
        return response

    def _api(self, method, endpoint, **kwargs):
        response = self._request(method, BASE + PREFIX + endpoint, **kwargs)
        try:
            if response.status_code == 404:
                if method == 'GET':
                    return None
                raise CloudError('Mutation target not found')
            try:
                return response.json()
            except (ValueError, TypeError):
                raise CloudError('Invalid API JSON; mutation may require inspection') from None
        finally:
            response.close()

    def list(self, path='/'):
        remote_path(path)
        data = self._api('GET', 'dir/', params={'path': path})
        if data is None:
            raise CloudError('Directory not found')
        if not isinstance(data, dict) or not isinstance(data.get('dirent_list'), list):
            raise CloudError('Invalid directory response')
        result, seen = [], set()
        for item in data['dirent_list']:
            if not isinstance(item, dict) or item.get('type') not in ('file', 'dir'):
                raise CloudError('Invalid directory entry')
            name = basename(item.get('name'))
            if name in seen:
                raise CloudError('Duplicate directory entry')
            seen.add(name)
            entry = {'path': posixpath.join(path, name), 'name': name, 'type': item['type']}
            if item['type'] == 'file':
                size = item.get('size')
                if type(size) is not int or size < 0:
                    raise CloudError('Invalid file size')
                entry['size'] = size
            result.append(entry)
        return result

    def stat(self, path):
        remote_path(path)
        if path == '/':
            self.list('/')
            return {'path': '/', 'name': '/', 'type': 'dir'}
        parent, name = posixpath.split(path)
        return next((item for item in self.list(parent) if item['name'] == name), None)

    def search(self, path='/', name='', *, recursive=False, max_items=1000):
        remote_path(path)
        if not isinstance(name, str) or type(max_items) is not int or max_items < 1:
            raise CloudError('Invalid search limit or name')
        pending, result, scanned = [path], [], 0
        while pending:
            directory = pending.pop()
            for item in self.list(directory):
                if scanned == max_items:
                    return {'items': result, 'scanned': scanned, 'truncated': True}
                scanned += 1
                if name in item['name']:
                    result.append(item)
                if recursive and item['type'] == 'dir':
                    pending.append(item['path'])
            if pending and scanned == max_items:
                return {'items': result, 'scanned': scanned, 'truncated': True}
        return {'items': result, 'scanned': scanned, 'truncated': False}

    def _require(self, path, kind=None):
        item = self.stat(path)
        if item is None or (kind and item['type'] != kind):
            raise CloudError('Required remote file or directory missing')
        return item

    def _verify(self, path, kind, size=None):
        item = self._require(path, kind)
        if size is not None and item.get('size') != size:
            raise CloudError('Remote size verification failed; inspect before retry')
        return item

    def mkdir(self, path, *, parents=False):
        remote_path(path)
        if path == '/':
            raise CloudError('Root mutation refused')
        targets = ['/' + '/'.join(path[1:].split('/')[:n]) for n in range(1, len(path.split('/')))] if parents else [path]
        for target in targets:
            existing = self.stat(target)
            if existing:
                if parents and existing['type'] == 'dir':
                    continue
                raise CloudError('Target already exists')
            self._require(posixpath.dirname(target), 'dir')
            data = self._api('POST', 'dir/', params={'path': target}, json={'operation': 'mkdir'})
            if not isinstance(data, dict) or data.get('type') != 'dir' or data.get('obj_name') != posixpath.basename(target):
                raise CloudError('Invalid mkdir response; inspect before retry')
            self._verify(target, 'dir')
        return self._require(path, 'dir')

    def _relocate_preflight(self, path, target):
        remote_path(path)
        remote_path(target)
        if path == '/' or target == '/' or target == path or target.startswith(path + '/') or path.startswith(target + '/'):
            raise CloudError('Root or overlapping relocation refused')
        source = self._require(path)
        self._require(posixpath.dirname(target), 'dir')
        if self.stat(target) is not None:
            raise CloudError('Destination exists; merge or overwrite refused')
        return source

    def _relocate_verify(self, path, target, source):
        if self.stat(path) is not None:
            raise CloudError('Source still exists; inspect before retry')
        return self._verify(target, source['type'], source.get('size'))

    def rename(self, path, name):
        remote_path(path)
        target = posixpath.join(posixpath.dirname(path), basename(name))
        source = self._relocate_preflight(path, target)
        payload = {'operation': 'rename', 'newname': name}
        data = self._api('POST', source['type'] + '/', params={'path': path},
                         **({'json': payload} if source['type'] == 'dir' else {'data': payload}))
        if not isinstance(data, dict) or data.get('type') != source['type'] or data.get('obj_name') != name:
            raise CloudError('Invalid rename response; inspect before retry')
        return self._relocate_verify(path, target, source)

    def move(self, path, to_dir):
        remote_path(path)
        remote_path(to_dir)
        target = posixpath.join(to_dir, posixpath.basename(path))
        source = self._relocate_preflight(path, target)
        data = self._api('POST', 'sync-batch-move-item/', json={
            'src_parent_dir': posixpath.dirname(path), 'dst_parent_dir': to_dir,
            'src_dirents': [posixpath.basename(path)]})
        if not isinstance(data, dict) or data.get('success') is not True:
            raise CloudError('Move not confirmed; inspect before retry')
        return self._relocate_verify(path, target, source)

    def delete(self, path, *, yes=False, recursive=False):
        remote_path(path)
        if path == '/' or not yes:
            raise CloudError('Root deletion refused; other deletions require --yes and user authorization')
        source = self._require(path)
        if source['type'] == 'dir' and self.list(path) and not recursive:
            raise CloudError('Non-empty directory requires --recursive')
        data = self._api('DELETE', source['type'] + '/', params={'path': path})
        if not isinstance(data, dict) or data.get('success') is not True:
            raise CloudError('Delete not confirmed; inspect before retry')
        if self.stat(path) is not None:
            raise CloudError('Delete readback failed; inspect before retry')
        return {'path': path, 'status': 'deleted', 'exists': False}

    def _upload_stream(self, source, size, path, overwrite, verify):
        remote_path(path)
        if path == '/' or verify not in ('size', 'sha256'):
            raise CloudError('Invalid upload target or verification mode')
        if size >= MAX_UPLOAD:
            raise CloudError('Files >=10GB refused; chunked upload is not implemented')
        parent, name = posixpath.split(path)
        self._require(parent, 'dir')
        existing = self.stat(path)
        if existing and (not overwrite or existing['type'] != 'file'):
            raise CloudError('Target exists; explicit overwrite required for files')
        digest = None
        if verify == 'sha256':
            digest = hashlib.sha256()
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
            source.seek(0)
        replace = '1' if overwrite else '0'
        url = self._api('GET', 'upload-link/', params={'path': parent, 'replace': replace})
        body = MultipartEncoder(fields={'parent_dir': parent, 'replace': replace,
                                       'file': (name, source, 'application/octet-stream')})
        response = self._request('POST', url, auth=False, params={'ret-json': '1'},
                                 data=body, headers={'Content-Type': body.content_type})
        try:
            try:
                data = response.json()
            except (ValueError, TypeError):
                raise CloudError('Invalid upload JSON; inspect before retry') from None
            if (response.status_code != 200 or not isinstance(data, list) or len(data) != 1
                    or not isinstance(data[0], dict) or data[0].get('name') != name
                    or type(data[0].get('size')) is not int or data[0]['size'] != size):
                raise CloudError('Invalid upload response; inspect before retry')
        finally:
            response.close()
        result = dict(self._verify(path, 'file', size), status='uploaded', verification=verify)
        if digest is not None:
            remote = hashlib.sha256()
            self._consume(path, remote.update)
            if remote.digest() != digest.digest():
                raise CloudError('Remote SHA256 mismatch; inspect before retry')
            result['sha256'] = digest.hexdigest()
        return result

    def upload(self, local, path, *, overwrite=False, verify='size'):
        remote_path(path)
        try:
            local = Path(local).expanduser().resolve(strict=True)
            protected = (Path.home() / '.config/tsinghua-cloud-drive').resolve()
            if local == self.config_path or local == protected or protected in local.parents:
                raise CloudError('Credential upload refused')
            if not local.is_file():
                raise CloudError('Non-regular upload source refused')
            with local.open('rb') as source:
                before = os.fstat(source.fileno())
                credential = self.config_path.stat() if self.config_path is not None else None
                if ((credential is not None and (before.st_dev, before.st_ino) == (credential.st_dev, credential.st_ino))
                        or not statmod.S_ISREG(before.st_mode)):
                    raise CloudError('Credential or non-regular source refused')
                result = self._upload_stream(source, before.st_size, path, overwrite, verify)
                after = os.fstat(source.fileno())
                if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                    raise CloudError('Local source changed; inspect remote state')
                return result
        except OSError:
            raise CloudError('Local upload source unavailable; inspect state if transfer started') from None

    def write(self, path, *, text=None, file=None, overwrite=False, verify='size'):
        remote_path(path)
        if (text is None) == (file is None):
            raise CloudError('Specify exactly one of text or file')
        if file is not None:
            return self.upload(file, path, overwrite=overwrite, verify=verify)
        if not isinstance(text, str):
            raise CloudError('Text must be a UTF-8 string')
        try:
            content = text.encode('utf-8')
        except UnicodeError:
            raise CloudError('Text must be a UTF-8 string') from None
        result = self._upload_stream(io.BytesIO(content), len(content), path, overwrite, verify)
        if len(content) <= 1024 * 1024:
            actual = io.BytesIO()
            self._consume(path, actual.write, max_bytes=1024 * 1024)
            if actual.getvalue() != content:
                raise CloudError('Remote text mismatch; inspect before retry')
        return result

    def _consume(self, path, sink, *, max_bytes=None):
        info = self._require(path, 'file')
        if max_bytes is not None and (type(max_bytes) is not int or max_bytes < 0 or info['size'] > max_bytes):
            raise CloudError('Read exceeds byte limit')
        url = self._api('GET', 'download-link/', params={'path': path})
        response = self._request('GET', url, auth=False, stream=True)
        count = 0
        try:
            if response.status_code != 200:
                raise CloudError('Download target missing')
            for block in response.iter_content(1024 * 1024):
                count += len(block)
                if count > info['size']:
                    raise CloudError('Download exceeds expected size')
                sink(block)
            if count != info['size']:
                raise CloudError('Download size mismatch')
        except requests.RequestException:
            raise CloudError('Download stream failed') from None
        finally:
            response.close()
        return info

    def read(self, path, *, max_bytes=1024 * 1024):
        buffer = io.BytesIO()
        info = self._consume(path, buffer.write, max_bytes=max_bytes)
        try:
            return dict(info, text=buffer.getvalue().decode('utf-8'))
        except UnicodeError:
            raise CloudError('Remote file is not UTF-8') from None

    def download(self, path, output, *, overwrite=False):
        remote_path(path)
        output = Path(output).expanduser()
        if output.is_symlink() or (output.exists() and not overwrite):
            raise CloudError('Local destination exists; overwrite refused')
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=output.parent, prefix='.cloud-download-', delete=False) as f:
                temporary = Path(f.name)
                info = self._consume(path, f.write)
                f.flush()
                os.fsync(f.fileno())
            if overwrite:
                os.replace(temporary, output)
            else:
                os.link(temporary, output)  # Atomic no-clobber publication, even under a race.
                temporary.unlink()
            return dict(info, status='downloaded', verification='size')
        except OSError:
            raise CloudError('Local download failed; existing destination preserved') from None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise CloudError('Invalid CLI arguments; use --help')


def main(argv=None):
    try:
        parser = Parser(description=__doc__)
        parser.add_argument('--config')
        commands = parser.add_subparsers(dest='command', required=True)
        for command in ('list', 'stat', 'search', 'mkdir', 'upload', 'download', 'read', 'write', 'rename', 'move', 'delete'):
            sub = commands.add_parser(command)
            if command == 'upload':
                sub.add_argument('local')
                sub.add_argument('--path', required=True)
            elif command == 'search':
                sub.add_argument('--path', default='/')
                sub.add_argument('--name', required=True)
                sub.add_argument('--recursive', action='store_true')
                sub.add_argument('--max-items', type=int, default=1000)
            else:
                sub.add_argument('path', **({'nargs': '?', 'default': '/'} if command == 'list' else {}))
            if command in ('upload', 'write', 'download'):
                sub.add_argument('--overwrite', action='store_true', help='Requires explicit user authorization')
            if command in ('upload', 'write'):
                sub.add_argument('--verify', choices=('size', 'sha256'), default='size')
            if command == 'mkdir':
                sub.add_argument('--parents', action='store_true')
            elif command == 'download':
                sub.add_argument('--output', required=True)
            elif command == 'read':
                sub.add_argument('--max-bytes', type=int, default=1024 * 1024)
            elif command == 'write':
                content = sub.add_mutually_exclusive_group(required=True)
                content.add_argument('--text')
                content.add_argument('--file')
            elif command == 'rename':
                sub.add_argument('--name', required=True)
            elif command == 'move':
                sub.add_argument('--to-dir', required=True)
            elif command == 'delete':
                sub.add_argument('--yes', action='store_true', help='Requires explicit user authorization')
                sub.add_argument('--recursive', action='store_true')
        args = vars(parser.parse_args(argv))
        command, config = args.pop('command'), args.pop('config')
        remote_path(args['path'])
        cloud = Cloud(config)
        result = getattr(cloud, command)(**args)
        if command == 'stat' and result is None:
            raise CloudError('Remote path does not exist')
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({'status': 'failed', 'error': str(exc) if isinstance(exc, CloudError)
                          else 'Operation failed; inspect remote state before retry'}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
