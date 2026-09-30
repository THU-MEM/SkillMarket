import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { unzipSync, zipSync, Zip, ZipDeflate } from 'fflate'

const built = await build({ entryPoints: [new URL('../src/publish-package.ts', import.meta.url).pathname], bundle: true, platform: 'browser', format: 'esm', write: false })
const api = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text + '\n//# sourceURL=publish-package-test-bundle.js').toString('base64')}`)
const { inspectZip, inspectFiles, exportPackage, isExcludedPath, PACKAGE_LIMITS } = api
const encoder = new TextEncoder()
function file(path, contents) {
  const result = new File([contents], path.split('/').at(-1))
  Object.defineProperty(result, 'webkitRelativePath', { value: path })
  return result
}

test('folder intake preserves supporting bytes, strips one common wrapper and exports stored ZIP', async () => {
  const bundle = await inspectFiles([file('demo/SKILL.md', '# Demo skill\n'), file('demo/assets/raw.bin', new Uint8Array([0, 255, 128]))])
  assert.equal(bundle.name, 'Demo skill')
  assert.equal(bundle.kind, 'skill')
  assert.equal(bundle.entryPath, 'SKILL.md')
  assert.deepEqual(bundle.files.map(f => f.path), ['SKILL.md', 'assets/raw.bin'])
  assert.equal(bundle.totalBytes, encoder.encode('# Demo skill\n').length + 3)
  assert.deepEqual(bundle.excluded, [])
  const blob = await exportPackage(bundle)
  assert.equal(blob.type, 'application/zip')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  assert.equal(new DataView(bytes.buffer).getUint16(8, true), 0)
  const unpacked = unzipSync(bytes)
  assert.deepEqual(unpacked['assets/raw.bin'], new Uint8Array([0, 255, 128]))
  assert.deepEqual(unpacked['SKILL.md'], encoder.encode('# Demo skill\n'))
})


test('shared hygiene excludes hidden/dependency/secret names before reading their bytes', async () => {
  const denied = ['.git/config', '.env', '.config/a', 'node_modules/x', '.venv/a', '__pycache__/a', '__MACOSX/a', '.DS_Store', 'credentials.json', 'auth.json', 'secrets.yaml', 'server.pem', 'key.KEY', 'id_rsa', 'id_ed25519', 'token.txt']
  let reads = 0
  const files = denied.map(path => ({ name: path, size: 100, stream() { reads++; throw Error('must not read') }, arrayBuffer() { reads++; throw Error('must not read') } }))
  for (const path of denied) assert.equal(isExcludedPath('root/' + path), true, path)
  assert.equal(isExcludedPath('references/authentication.md'), false)
  const bundle = await inspectFiles([file('SKILL.md', '# Safe'), ...files])
  assert.equal(reads, 0)
  assert.deepEqual(bundle.excluded, denied)
  assert.equal(bundle.files.length, 1)
})

for (const path of ['../bad', '/bad', 'C:/bad', 'a\\bad', 'a/../bad', 'a/./bad', 'a//bad', 'a/CON.txt', 'a/trailing.', 'a/space ', 'a/stream:x', 'a/\u0000x', 'a/\u202ex', 'a/．．/bad', 'a/／bad', 'a/'.repeat(17) + 'x']) {
  test(`folder rejects unsafe path ${JSON.stringify(path)}`, async () => {
    await assert.rejects(inspectFiles([file('SKILL.md', '# Safe'), file(path, 'x')]), /路径/)
  })
}
for (const paths of [['A.txt', 'a.txt'], ['é.txt', 'e\u0301.txt'], ['Straße.txt', 'STRASSE.txt'], ['Ａ.txt', 'A.txt'], ['refs', 'refs/a.txt']]) {
  test(`folder rejects colliding paths ${JSON.stringify(paths)}`, async () => {
    await assert.rejects(inspectFiles([file('SKILL.md', '# Safe'), ...paths.map(path => file(path, 'x'))]), /重复|冲突/)
  })
}

test('folder enforces count, depth, claimed and actual byte limits', async () => {
  assert.deepEqual(PACKAGE_LIMITS, { maxFiles: 300, maxTotalBytes: 20 * 1024 * 1024, maxFileBytes: 4 * 1024 * 1024, maxDepth: 16, maxZipBytes: 20 * 1024 * 1024, maxEntryBytes: 256 * 1024 })
  await assert.rejects(inspectFiles(Array.from({ length: 301 }, (_, n) => file(`${n}.txt`, ''))), /数量/)
  await assert.rejects(inspectFiles([file('SKILL.md', '# Safe'), file('big', new Uint8Array(PACKAGE_LIMITS.maxFileBytes + 1))]), /大小/)
  await assert.rejects(inspectFiles([file('SKILL.md', '#'.repeat(PACKAGE_LIMITS.maxEntryBytes + 1))]), /入口/)
  const liar = { name: 'big', size: 1, stream: () => new Blob([new Uint8Array(PACKAGE_LIMITS.maxFileBytes + 1)]).stream() }
  await assert.rejects(inspectFiles([file('SKILL.md', '# Safe'), liar]), /大小/)
  await assert.rejects(inspectFiles([file('SKILL.md', '# Safe'), ...Array.from({ length: 6 }, (_, n) => file(`${n}.bin`, new Uint8Array(PACKAGE_LIMITS.maxFileBytes)))]), /总大小/)
})

test('entry discovery is case-insensitive, nested, unambiguous and supports existing kinds', async () => {
  for (const [entry, kind] of [['nested/skill.MD', 'skill'], ['AGENTS.md', 'agent'], ['AGENT.md', 'agent'], ['PROMPT.md', 'prompt'], ['README.md', 'prompt']]) {
    const bundle = await inspectFiles([file(`root/${entry}`, '---\nname: "Safe name"\n---\nbody')])
    assert.equal(bundle.kind, kind)
    assert.equal(bundle.entryPath, entry)
    assert.equal(bundle.name, 'Safe name')
  }
  const bundle = await inspectFiles([file('a/SKILL.md', '# One'), file('b/README.md', '# Two')])
  assert.equal(bundle.entryPath, 'a/SKILL.md')
  await assert.rejects(inspectFiles([file('a/SKILL.md', '# One'), file('b/SKILL.md', '# Two')]), /多个/)
  await assert.rejects(inspectFiles([file('AGENT.md', '# One'), file('AGENTS.md', '# Two')]), /多个/)
  await assert.rejects(inspectFiles([file('a/README.md', '# One'), file('b/README.md', '# Two')]), /多个/)
  await assert.rejects(inspectFiles([file('no-entry.txt', 'x')]), /入口/)
  await assert.rejects(inspectFiles([file('SKILL.md', new Uint8Array([255, 0]))]), /UTF-8|文本/)
})

test('export distrusts mutated paths and re-applies hygiene and limits', async () => {
  const bundle = await inspectFiles([file('SKILL.md', '# Safe')])
  for (const path of ['../escape', '.env', 'credentials.json', 'SKILL.MD']) {
    await assert.rejects(exportPackage({ ...bundle, files: [...bundle.files, { path, bytes: encoder.encode('secret') }] }))
  }
  await assert.rejects(exportPackage({ ...bundle, files: [...bundle.files, { path: 'big', bytes: new Uint8Array(PACKAGE_LIMITS.maxFileBytes + 1) }] }), /大小/)
  const nested = await inspectFiles([file('one/two/SKILL.md', '# Safe')])
  const unpacked = unzipSync(new Uint8Array(await (await exportPackage(nested)).arrayBuffer()))
  assert.deepEqual(Object.keys(unpacked), ['two/SKILL.md'], 'export must not strip another wrapper')
})


function zipFile(entries, options = {}) {
  return new File([zipSync(Object.fromEntries(Object.entries(entries).map(([p, data]) => [p, typeof data === 'string' ? encoder.encode(data) : data])), options)], 'input.zip')
}

test('ZIP intake supports stored/deflated data, Unicode assets, directories and exclusions', async () => {
  for (const level of [0, 6]) {
    const input = zipFile({ 'demo/': new Uint8Array(), 'demo/SKILL.md': '# Demo', 'demo/references/中文.md': '中文资料', 'demo/assets/raw.bin': new Uint8Array([255, 0, 128]), 'demo/.env': 'secret' }, { level })
    const bundle = await inspectZip(input)
    assert.equal(bundle.entryPath, 'SKILL.md')
    assert.equal(bundle.name, 'Demo')
    assert.deepEqual(bundle.excluded, ['demo/.env'])
    assert.deepEqual(bundle.files.map(f => f.path), ['SKILL.md', 'references/中文.md', 'assets/raw.bin'])
    assert.deepEqual(bundle.files[2].bytes, new Uint8Array([255, 0, 128]))
    const again = await inspectZip(new File([await exportPackage(bundle)], 'clean.zip'))
    assert.deepEqual(again.files, bundle.files)
    assert.deepEqual(again.excluded, [])
  }
})

test('ZIP intake supports streamed data descriptors from real ZIP library', async () => {
  const chunks = []
  const archive = new Zip((error, chunk) => { assert.ifError(error); chunks.push(chunk) })
  const entry = new ZipDeflate('SKILL.md')
  archive.add(entry)
  entry.push(encoder.encode('# Streamed'), true)
  archive.end()
  const bundle = await inspectZip(new File(chunks, 'streamed.zip'))
  assert.equal(bundle.name, 'Streamed')
})


async function zipBytes(entries = { 'SKILL.md': '# Safe' }, options = { level: 0 }) {
  return new Uint8Array(await zipFile(entries, options).arrayBuffer())
}
function layout(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  const central = view.getUint32(end + 16, true)
  const data = 30 + view.getUint16(26, true) + view.getUint16(28, true)
  return { view, end, central, data }
}

for (const [label, mutate] of [
  ['encrypted', (b, { view, central }) => { view.setUint16(6, 1, true); view.setUint16(central + 8, 1, true) }],
  ['strong encryption', (b, { view, central }) => { view.setUint16(6, 64, true); view.setUint16(central + 8, 64, true) }],
  ['symlink', (b, { view, central }) => { b[central + 5] = 3; view.setUint32(central + 38, 0xa1ff0000, true) }],
  ['special file', (b, { view, central }) => { b[central + 5] = 3; view.setUint32(central + 38, 0x11ff0000, true) }],
  ['CRC damage', (b, { data }) => { b[data] ^= 1 }],
  ['central/local CRC disagreement', (b, { view }) => { view.setUint32(14, 0, true) }],
  ['local name disagreement', b => { b[30] = 65 }],
  ['local method disagreement', (b, { view }) => { view.setUint16(8, 8, true) }],
  ['central size lie', (b, { view, central }) => { view.setUint32(central + 24, 1, true) }],
  ['local header pointer', (b, { view, central }) => { view.setUint32(central + 42, 1, true) }],
  ['multi disk', (b, { view, end }) => { view.setUint16(end + 4, 1, true) }],
  ['ZIP64 sentinel', (b, { view, end }) => { view.setUint16(end + 10, 65535, true) }],
  ['central size mismatch', (b, { view, end }) => { view.setUint32(end + 12, 0, true) }],
  ['invalid UTF8 name', (b, { view, central }) => { view.setUint16(6, 2048, true); view.setUint16(central + 8, 2048, true); b[30] = b[central + 46] = 255 }],
]) {
  test(`ZIP rejects ${label}`, async () => {
    const bytes = await zipBytes()
    mutate(bytes, layout(bytes))
    await assert.rejects(inspectZip(new File([bytes], 'bad.zip')))
  })
}

for (const paths of [['A.txt', 'a.txt'], ['é.txt', 'e\u0301.txt'], ['Straße.txt', 'STRASSE.txt'], ['refs', 'refs/child']]) {
  test(`ZIP rejects duplicate/conflicting names ${JSON.stringify(paths)}`, async () => {
    await assert.rejects(inspectZip(zipFile({ 'SKILL.md': '# Safe', ...Object.fromEntries(paths.map(p => [p, 'x'])) })), /重复|冲突/)
  })
}
for (const path of ['../bad', '/bad', 'a\\bad', 'C:/bad', 'a//bad', '.git/../bad']) {
  test(`ZIP rejects unsafe paths even in excluded entries ${path}`, async () => {
    await assert.rejects(inspectZip(zipFile({ 'SKILL.md': '# Safe', [path]: 'x' })), /路径/)
  })
}

test('ZIP rejects true duplicate raw entries rather than silently overwriting', async () => {
  const chunks = []
  const archive = new Zip((error, chunk) => { assert.ifError(error); chunks.push(chunk) })
  for (const contents of ['# First', '# Second']) {
    const entry = new ZipDeflate('SKILL.md')
    archive.add(entry); entry.push(encoder.encode(contents), true)
  }
  archive.end()
  await assert.rejects(inspectZip(new File(chunks, 'duplicate.zip')), /重复/)
})

test('ZIP rejects truncation, extra suffix and forged empty payload', async () => {
  const bytes = await zipBytes()
  await assert.rejects(inspectZip(new File([bytes.slice(0, -1)], 'truncated.zip')))
  await assert.rejects(inspectZip(new File([bytes, new Uint8Array([0])], 'suffix.zip')))
  const { view, central } = layout(bytes)
  view.setUint32(18, 0, true); view.setUint32(central + 20, 0, true)
  await assert.rejects(inspectZip(new File([bytes], 'empty.zip')))
})

test('ZIP rejects declared budgets and counts directories against entry limit', async () => {
  const entries = Object.fromEntries(Array.from({ length: 300 }, (_, n) => [`${n}/`, new Uint8Array()]))
  entries['SKILL.md'] = '# Safe'
  await assert.rejects(inspectZip(zipFile(entries)), /数量/)
  await assert.rejects(inspectZip(zipFile({ 'SKILL.md': '# Safe', 'big': new Uint8Array(PACKAGE_LIMITS.maxFileBytes + 1) })), /大小/)
  const many = Object.fromEntries(Array.from({ length: 6 }, (_, n) => [`${n}`, new Uint8Array(PACKAGE_LIMITS.maxFileBytes)]))
  await assert.rejects(inspectZip(zipFile({ 'SKILL.md': '# Safe', ...many })), /总大小/)
})

test('ZIP bounds actual decompression with forged small headers, including excluded files', async () => {
  for (const path of ['bomb.bin', '.env']) {
    const bytes = await zipBytes({ [path]: new Uint8Array(32 * 1024 * 1024), 'SKILL.md': '# Safe' }, { level: 9 })
    assert.ok(bytes.length < 100000)
    const { view, central } = layout(bytes)
    view.setUint32(22, 1, true); view.setUint32(central + 24, 1, true)
    await assert.rejects(inspectZip(new File([bytes], 'bomb.zip')), /大小|长度/)
  }
})

test('ZIP input bound checks actual bytes and cancels source without reading all', async () => {
  let pulls = 0, cancelled = false
  const input = { name: 'liar.zip', size: 1, stream: () => new ReadableStream({ pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024 * 1024)) }, cancel() { cancelled = true } }) }
  await assert.rejects(inspectZip(input), /大小/)
  assert.equal(cancelled, true)
  assert.ok(pulls <= 23)
})

test('export preserves prototype-like filenames rather than losing files through ZIP object maps', async () => {
  const bundle = await inspectFiles([file('SKILL.md', '# Safe'), file('__proto__', 'support'), file('constructor', 'bytes')])
  const again = await inspectZip(new File([await exportPackage(bundle)], 'clean.zip'))
  assert.deepEqual(again.files, bundle.files)
})
