import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { zipSync } from 'fflate'

async function load(path) {
  const result = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, platform: 'node', format: 'cjs', write: false })
  const context = { module: { exports: {} }, require: createRequire(import.meta.url), URLSearchParams, File, Blob, TextEncoder, TextDecoder, ReadableStream, DecompressionStream, setTimeout, clearTimeout }
  vm.runInNewContext(result.outputFiles[0].text, context)
  return context.module.exports
}

test('agent instructions complete the publication without tokens or direct main writes', async () => {
  const { AGENT_PUBLISH_PROMPT, SUBMISSION_URL } = await load('../src/publish-instructions.ts')
  for (const text of ['THU-MEM/SkillMarket', 'CONTRIBUTING.md', 'ZIP', '不执行', 'npm run check', 'Pull Request', 'main', 'Token', '未完成']) assert.ok(AGENT_PUBLISH_PROMPT.includes(text), text)
  const url = new URL(SUBMISSION_URL)
  assert.equal(url.origin, 'https://github.com')
  assert.equal(url.pathname, '/THU-MEM/SkillMarket/issues/new')
  assert.ok(url.searchParams.get('body').includes('附件'))
  assert.ok(url.searchParams.get('body').includes('审核'))
  assert.ok(!url.searchParams.has('token'))
})

function fileEntry(name, text = '# skill', read = () => {}) {
  return { name, isFile: true, isDirectory: false, file(done) { read(); done(new File([text], name)) } }
}
function directory(name, batches) {
  return { name, isFile: false, isDirectory: true, createReader() {
    let index = 0
    return { readEntries(done) { done(batches[index++] ?? []) } }
  } }
}
const policy = { maxFiles: 300, maxDepth: 16, maxTotalBytes: 20 * 1024 * 1024, maxFileBytes: 4 * 1024 * 1024, maxZipBytes: 20 * 1024 * 1024, isExcludedPath: p => p.split('/').some(x => x.startsWith('.') || x === 'node_modules') }
const transfer = entries => ({ items: entries.map(entry => ({ kind: 'file', webkitGetAsEntry: () => entry })), files: [] })

test('single top-level ZIP drop accepts a valid archive above the member-file limit', async () => {
  const { collectDroppedFiles } = await load('../src/publish-drop.ts')
  const { inspectZip, PACKAGE_LIMITS, isExcludedPath } = await load('../src/publish-package.ts')
  const bytes = zipSync({
    'SKILL.md': new TextEncoder().encode('# Demo'),
    'assets/one.bin': new Uint8Array(3 * 1024 * 1024),
    'assets/two.bin': new Uint8Array(3 * 1024 * 1024),
  }, { level: 0 })
  assert.ok(bytes.length > PACKAGE_LIMITS.maxFileBytes)
  assert.ok(bytes.length < PACKAGE_LIMITS.maxZipBytes)
  assert.equal((await inspectZip(new File([bytes], 'demo.ZIP'))).files.length, 3)
  const result = await collectDroppedFiles(transfer([fileEntry('demo.ZIP', bytes)]), { ...PACKAGE_LIMITS, isExcludedPath })
  assert.equal(result.files.length, 1)
  assert.equal(result.files[0].size, bytes.length)
  assert.equal(result.files[0].webkitRelativePath, 'demo.ZIP')
  assert.equal((await inspectZip(result.files[0])).files.length, 3)
})

test('ZIP drop exception preserves folder, non-ZIP, multi-file and archive size limits', async () => {
  const { collectDroppedFiles } = await load('../src/publish-drop.ts')
  const oversizedMember = new Uint8Array(policy.maxFileBytes + 1)
  for (const entries of [
    [directory('demo', [[fileEntry('nested.zip', oversizedMember)]])],
    [fileEntry('asset.bin', oversizedMember)],
    [fileEntry('demo.zip', oversizedMember), fileEntry('SKILL.md')],
    [fileEntry('demo.zip', oversizedMember), directory('.git', [])],
  ]) {
    await assert.rejects(collectDroppedFiles(transfer(entries), policy), /文件体积超限/)
  }
  await assert.rejects(collectDroppedFiles(transfer([fileEntry('huge.zip', new Uint8Array(policy.maxZipBytes + 1))]), {
    ...policy, maxTotalBytes: policy.maxZipBytes * 2,
  }), /文件体积超限/)
})

test('folder drop drains all reader batches and skips excluded directories before reading', async () => {
  const { collectDroppedFiles } = await load('../src/publish-drop.ts')
  let secretRead = false
  const result = await collectDroppedFiles(transfer([directory('demo', [[fileEntry('SKILL.md')], [directory('references', [[fileEntry('guide.md')]]), directory('.git', [[fileEntry('secret', 'secret', () => { secretRead = true })]])]])]), policy)
  assert.deepEqual(Array.from(result.files, f => f.webkitRelativePath), ['demo/SKILL.md', 'demo/references/guide.md'])
  assert.equal(await result.files[1].text(), '# skill')
  assert.deepEqual(Array.from(result.excluded), ['demo/.git/'])
  assert.equal(secretRead, false)
})

test('folder drop handles file fallback, rejects empty, excess and failed directory reads', async () => {
  const { collectDroppedFiles } = await load('../src/publish-drop.ts')
  const zip = new File(['zip'], 'demo.zip')
  assert.equal((await collectDroppedFiles({ items: [], files: [zip] }, policy)).files[0], zip)
  await assert.rejects(collectDroppedFiles({ items: [], files: [] }, policy), /选择 ZIP|文件夹/)
  await assert.rejects(collectDroppedFiles(transfer([directory('demo', [[fileEntry('one'), fileEntry('two')]])]), { ...policy, maxFiles: 1 }), /文件数量/)
  await assert.rejects(collectDroppedFiles(transfer([directory('demo', [[directory('nested', [[fileEntry('one')]])]])]), { ...policy, maxDepth: 1 }), /层级/)
  await assert.rejects(collectDroppedFiles(transfer([{ name: 'denied', isDirectory: true, createReader: () => ({ readEntries: (_done, fail) => fail(new Error('private path details')) }) }]), policy), /无法读取文件夹/)
})
