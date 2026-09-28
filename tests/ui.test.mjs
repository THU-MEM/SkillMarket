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

test('public branding uses the Chinese market name without the organization subtitle', async () => {
  const html = render('#/')
  assert.match(html, /aria-label="清工技能市场 首页"/)
  assert.match(html, />清工技能市场<\/span>/)
  assert.doesNotMatch(html.replace(/<[^>]+>/g, ''), /THU[–-]MEM|SkillMarket/)
  const index = await readFile(`${root}index.html`, 'utf8')
  assert.match(index, /<title>清工技能市场/)
})

test('skill pages offer copyable npx installation separately from client-specific methods', async () => {
  for (const entry of registry.filter(e => e.type === 'skill')) {
    const source = await readFile(`${root}${entry.source.primaryFile}`, 'utf8')
    assert.ok(source.split('\n').includes(`name: ${entry.id}`), 'npx --skill must match SKILL.md frontmatter')
    const html = render(`#/item/${entry.id}`)
    assert.ok(html.includes('通用 npx 安装'), entry.id)
    assert.ok(new RegExp(`npx skills(?:@[0-9.]+)? add THU-MEM/SkillMarket --skill ${entry.id}(?: --copy)?`).test(html), entry.id)
    assert.ok(html.includes('第三方安装器'))
    assert.ok(html.includes('覆盖'))
    assert.ok(html.includes('aria-label="复制 npx 安装命令"'))
  }
  assert.ok(render('#/guides').includes('npx skills'))
  for (const entry of registry.filter(e => e.type !== 'skill')) {
    assert.ok(!render(`#/item/${entry.id}`).includes('通用 npx 安装'))
  }
})

test('cloud setup exposes token type, acquisition and private configuration before usage', () => {
  const html = render('#/item/tsinghua-cloud-drive')
  for (const text of ['获取与配置 Token', 'API Token', 'Repo-Token', 'TSINGHUA_CLOUD_TOKEN', 'TSINGHUA_CLOUD_REPO_ID', 'list /']) {
    assert.ok(html.includes(text), text)
  }
  assert.ok(html.includes('https://cloud.tsinghua.edu.cn'))
  assert.ok(html.includes('docs/TSINGHUA_CLOUD_SETUP.md'))
  assert.ok(!render('#/item/accessibility-audit').includes('获取与配置 Token'))
})

test('catalog presents each real entry once, with direct search and no marketing footer', () => {
  const html = render('#/')
  for (const entry of registry) assert.equal(html.split(`href=\"#/item/${entry.id}\"`).length - 1, 1)
  assert.match(html, /aria-label=\"类型\"/)
  assert.doesNotMatch(html, /<footer/)
})

test('overview uses whole-catalog counts even when filtered, with sampled history and explicit card actions', () => {
  for (const hash of ['#/', '#/?type=prompt&search=missing']) {
    const html = render(hash)
    assert.ok(html.includes('全目录概览'), 'show an honest whole-catalog overview')
    assert.ok(html.includes(`aria-label="全目录 ${registry.length} 个资源"`))
    assert.ok(html.includes('历史采样，非安装量或活跃量'))
    assert.ok(!html.includes('discovery-note'))
  }
  const html = render('#/')
  assert.ok(html.includes('查看安装'))
  assert.ok(html.includes('使用说明'))
  assert.ok(html.includes('aria-label="查看 accessibility-audit 的 GitHub 源码"'))
  assert.ok(render('#/item/accessibility-audit').includes('选择 Agent、范围与系统'))
})

test('hash filters restore results and detail return preserves the catalog query', () => {
  const html = render('#/?search=无障碍&type=skill&tags=accessibility&sort=name')
  assert.match(html, /value="无障碍"/)
  assert.match(html, /href="#\/item\/accessibility-audit\?search=/)
  assert.doesNotMatch(html, /class="entry-title"><h2>Issue Triage/)
  const detail = render('#/item/accessibility-audit?search=test&type=skill&tags=accessibility&sort=name&client=codex')
  assert.match(detail, /class="back-link" href="#\/\?search=test&amp;type=skill&amp;tags=accessibility&amp;sort=name"/)
  assert.match(detail, /value="codex" selected=""/)
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
  // Restore SSR environment: the partial document stub is only for the skip action.
  // React Aria correctly treats a present document as a real browser DOM.
  delete context.document
  assert.match(render('#/'), /class="skip-link"/)
})

test('malformed URI renders a safe not-found page instead of crashing', () => {
  assert.match(render('#/item/%E0%A4%A'), /404/)
})
