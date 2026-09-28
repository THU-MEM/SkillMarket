import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const result = await build({ entryPoints: [new URL('../src/components/catalogState.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'cjs', write: false })
const context = { module: { exports: {} }, require: createRequire(import.meta.url), URLSearchParams }
vm.runInNewContext(result.outputFiles[0].text, context)
const { readCatalogState, catalogHash } = context.module.exports
const plain = value => JSON.parse(JSON.stringify(value))

test('only known filter values survive untrusted hash queries', () => {
  assert.deepEqual(plain(readCatalogState('#/?search=hello&type=bogus&sort=downloads&tags=security,unknown,security&tags=frontend&junk=x', ['security', 'frontend'])), {
    query: 'hello', type: 'all', sort: 'newest', selectedTags: ['security', 'frontend'],
  })
})
test('catalog → detail → catalog round trip preserves filters without consuming client', () => {
  const state = { query: '无障碍 & ? 中文', type: 'skill', sort: 'name', selectedTags: ['security', 'frontend'] }
  const detail = catalogHash(state, 'item/accessibility-audit', 'codex')
  assert.equal(new URLSearchParams(detail.split('?')[1]).get('client'), 'codex')
  assert.deepEqual(plain(readCatalogState(detail, state.selectedTags)), state)
  assert.equal(catalogHash(readCatalogState(detail, state.selectedTags)), catalogHash(state))
})
test('serializer never writes unknown type, sort, or client values', () => {
  const hash = catalogHash({ query: '', type: 'bogus', sort: 'downloads', selectedTags: [] }, 'item/a', 'unknown-client')
  assert.equal(hash, '#/item/a')
})
test('empty and malformed filter state safely defaults; search is bounded', () => {
  assert.equal(catalogHash(readCatalogState('#/', [])), '#/')
  assert.equal(readCatalogState('#/?search=' + 'x'.repeat(500), []).query.length, 300)
  assert.equal(readCatalogState('#/?type=__proto__&tags=%', []).selectedTags.length, 0)
})
