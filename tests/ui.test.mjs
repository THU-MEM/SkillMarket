import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const root = new URL('../', import.meta.url).pathname
const registry = []
for (const folder of ['skills', 'agents', 'prompts']) {
  for (const file of await readdir(`${root}registry/${folder}`)) {
    if (file.endsWith('.json')) registry.push(JSON.parse(await readFile(`${root}registry/${folder}/${file}`, 'utf8')))
  }
}
const result = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import App from './src/App'; export { default as SkipLink } from './src/components/SkipLink'; export { filterEntries, platformMethods, clientLabels } from './src/components/catalog'; export function render(){return renderToStaticMarkup(React.createElement(App))}`,
    resolveDir: root, loader: 'tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  plugins: [{ name: 'real-registry', setup(builder) {
    builder.onLoad({ filter: /\/src\/registry\.ts$/ }, () => ({ contents: `export const entries=${JSON.stringify(registry)};export const entryById=new Map(entries.map(e=>[e.id,e]));export const tags=[...new Set(entries.flatMap(e=>e.tags))].sort();`, loader: 'js' }))
  } }],
})
const context = { module: { exports: {} }, exports: {}, require: createRequire(import.meta.url), process, console, queueMicrotask, TextEncoder, TextDecoder, URLSearchParams, setTimeout, clearTimeout, window: { location: { hash: '#/' } } }
context.exports = context.module.exports
vm.runInNewContext(result.outputFiles[0].text, context)
const render = (hash) => { context.window.location.hash = hash; return context.module.exports.render() }

test('catalog presents each real entry once, with direct search and no marketing footer', () => {
  const html = render('#/')
  for (const entry of registry) assert.equal(html.split(`href=\"#/item/${entry.id}\"`).length - 1, 1)
  assert.match(html, /aria-label=\"类型\"/)
  assert.doesNotMatch(html, /<footer/)
})

test('skill details have platform selection and collapsed supporting instructions', () => {
  const entry = registry.find(e => e.type === 'skill')
  const html = render(`#/item/${entry.id}`)
  assert.match(html, /aria-label=\"操作系统\"/)
  assert.match(html, /<details/)
})

test('Chinese search, intersection filters, ordering and empty results use real entries', () => {
  const { filterEntries } = context.module.exports
  const ids = values => Array.from(values, e => e.id)
  const original = registry.map(e => e.id)
  assert.ok(ids(filterEntries(registry, '无障碍', 'skill', [], 'name')).includes('accessibility-audit'))
  assert.ok(ids(filterEntries(registry, '前端', 'all', [], 'name')).includes('accessibility-audit'))
  assert.equal(filterEntries(registry, 'no-such-entry-xyz', 'all', [], 'newest').length, 0)
  assert.equal(filterEntries(registry, '', 'prompt', ['accessibility'], 'newest').length, 0)
  const oldest = filterEntries(registry, '', 'all', [], 'oldest')
  assert.ok(oldest.every((e, i) => i === 0 || oldest[i - 1].updatedAt <= e.updatedAt))
  assert.deepEqual(registry.map(e => e.id), original)
})

test('platform filtering never invents methods or scopes; all eight client labels exist', () => {
  const { platformMethods, clientLabels } = context.module.exports
  assert.equal(Object.keys(clientLabels).length, 8)
  for (const entry of registry.filter(e => e.type === 'skill')) {
    for (const platform of ['windows', 'macos', 'linux', 'web']) {
      const methods = platformMethods(entry.installations, platform)
      assert.deepEqual(Array.from(methods, m => m.id), entry.installations.filter(m => m.platforms.includes(platform)).map(m => m.id))
      for (const method of methods) assert.ok(entry.installations.includes(method))
    }
  }
})

test('prompt template is copyable and unknown routes are safe', () => {
  const prompt = registry.find(e => e.type === 'prompt')
  assert.match(render(`#/item/${prompt.id}`), /aria-label="复制提示词模板"/)
  for (const route of ['#/unknown', '#/item/missing', '#/item/%', '#/item/']) assert.match(render(route), /404/)
})

test('guide documentation links point at existing repository files', async () => {
  const html = render('#/guides')
  for (const [, path] of html.matchAll(/href="https:\/\/github.com\/THU-MEM\/SkillMarket\/blob\/main\/(docs\/[^"#]+)"/g)) {
    await assert.doesNotReject(readFile(`${root}${path}`))
  }
})

test('client deep links select that client and guides preserve the selection', () => {
  const html = render('#/item/accessibility-audit?client=codex')
  assert.match(html, /value="codex" selected=""/)
  assert.match(html, /--agent codex/)
  assert.doesNotMatch(html, /404/)
  assert.match(render('#/guides'), /#\/item\/accessibility-audit\?client=github-copilot/)
})

test('keyboard skip action prevents hash routing and focuses current main content', () => {
  const calls = []
  const main = { tabIndex: 0, focus: () => calls.push('focus'), scrollIntoView: () => calls.push('scroll') }
  context.document = { getElementById: id => id === 'main-content' ? main : null }
  context.module.exports.SkipLink().props.onClick({ preventDefault: () => calls.push('prevent') })
  assert.equal(main.tabIndex, -1)
  assert.deepEqual(calls, ['prevent', 'focus', 'scroll'])
  assert.match(render('#/'), /class="skip-link"/)
})

test('malformed URI renders a safe not-found page instead of crashing', () => {
  assert.match(render('#/item/%E0%A4%A'), /404/)
})
