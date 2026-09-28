import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = fileURLToPath(new URL('../', import.meta.url))
const script = path.join(repo, 'scripts/install-skill.mjs')
async function sandbox(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'skillmarket-test-')))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  await fs.mkdir(home); await fs.mkdir(project)
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config'), HERMES_HOME: path.join(home, '.hermes'), HERMES_PROFILE: '' }
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: project, env, encoding: 'utf8' })
  return { root, home, project, env, run }
}
async function tree(dir) {
  const result = {}
  for (const name of (await fs.readdir(dir)).sort()) {
    const p = path.join(dir, name)
    if ((await fs.lstat(p)).isDirectory()) {
      result[name + '/'] = null
      for (const [key, value] of Object.entries(await tree(p))) result[name + '/' + key] = value
    } else result[name] = (await fs.readFile(p)).toString('base64')
  }
  return result
}
test('installs exactly the selected first-party skill with byte-identical tree', async t => {
  const s = await sandbox(t)
  const result = s.run('--skill', 'accessibility-audit', '--agent', 'claude-code', '--scope', 'project')
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(await tree(path.join(s.project, '.claude/skills/accessibility-audit')), await tree(path.join(repo, 'examples/accessibility-audit')))
  assert.deepEqual(await fs.readdir(path.join(s.project, '.claude/skills')), ['accessibility-audit'])
  assert.deepEqual(await fs.readdir(s.home), [])
})
const clients = { 'claude-code': ['.claude/skills', '.claude/skills'], codex: ['.agents/skills', '.agents/skills'], cursor: ['.cursor/skills', '.cursor/skills'], opencode: ['.opencode/skills', '.config/opencode/skills'], 'github-copilot': ['.github/skills', '.copilot/skills'], 'github-copilot-cli': ['.github/skills', '.copilot/skills'], hermes: [null, '.hermes/skills'] }
for (const [client, roots] of Object.entries(clients)) for (const [index, scope] of ['project', 'user'].entries()) {
  if (!roots[index]) continue
  test(`installs complete tree for ${client}/${scope}`, async t => {
    const s = await sandbox(t)
    const r = s.run('--skill', 'release-notes-writer', '--agent', client, '--scope', scope)
    assert.equal(r.status, 0, r.stderr)
    const target = path.join(scope === 'project' ? s.project : s.home, roots[index], 'release-notes-writer')
    assert.deepEqual(await tree(target), await tree(path.join(repo, 'examples/release-notes-writer')))
  })
}

test('list and dry-run do not write; unsupported client/scope and ambiguous flags fail closed', async t => {
  const s = await sandbox(t)
  const list = s.run('--list')
  assert.equal(list.status, 0, list.stderr)
  assert.deepEqual(JSON.parse(list.stdout).skills, ['accessibility-audit', 'release-notes-writer'])
  const dry = s.run('--skill', 'accessibility-audit', '--agent', 'codex', '--scope', 'project', '--dry-run')
  assert.equal(dry.status, 0, dry.stderr)
  assert.equal(JSON.parse(dry.stdout).dryRun, true)
  assert.deepEqual(await fs.readdir(s.project), [])
  for (const args of [ ['--skill', '../accessibility-audit'], ['--skill', 'accessibility-audit', '--agent', 'universal', '--scope', 'project'], ['--skill', 'accessibility-audit', '--agent', 'hermes', '--scope', 'project'], ['--skill', 'accessibility-audit', '--agent', 'codex', '--scope', 'project', '--force'], ['--list', '--skill', 'accessibility-audit'] ]) assert.notEqual(s.run(...args).status, 0)
})
async function fixture(s) {
  const sourceRepo = path.join(s.root, 'checkout')
  await fs.mkdir(path.join(sourceRepo, 'scripts'), { recursive: true })
  await fs.copyFile(script, path.join(sourceRepo, 'scripts/install-skill.mjs'))
  await fs.cp(path.join(repo, 'registry'), path.join(sourceRepo, 'registry'), { recursive: true })
  await fs.cp(path.join(repo, 'examples'), path.join(sourceRepo, 'examples'), { recursive: true })
  return { sourceRepo, source: path.join(sourceRepo, 'examples/accessibility-audit'), run: (...args) => spawnSync(process.execPath, [path.join(sourceRepo, 'scripts/install-skill.mjs'), '--skill', 'accessibility-audit', '--agent', 'codex', '--scope', 'project', ...args], { cwd: s.project, env: s.env, encoding: 'utf8' }) }
}
test('copies nested scripts, references and binary assets without executing scripts', async t => {
  const s = await sandbox(t), f = await fixture(s)
  await fs.mkdir(path.join(f.source, 'scripts')); await fs.mkdir(path.join(f.source, 'references'))
  await fs.writeFile(path.join(f.source, 'scripts/do-not-run.mjs'), 'throw Error("MUST NOT EXECUTE")')
  await fs.writeFile(path.join(f.source, 'references/bytes.bin'), Buffer.from([0, 255, 10, 13]))
  const r = f.run(); assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(await tree(path.join(s.project, '.agents/skills/accessibility-audit')), await tree(f.source))
})
for (const bad of ['.env', 'node_modules', '.cache', 'credentials.json', 'auth.json', '.git', 'id_rsa']) test(`rejects forbidden source ${bad} before any target writes`, async t => {
  const s = await sandbox(t), f = await fixture(s)
  await fs.writeFile(path.join(f.source, bad), 'test fixture, not a credential')
  const r = f.run(); assert.notEqual(r.status, 0, r.stdout)
  assert.deepEqual(await fs.readdir(s.project), [])
})
test('rejects source traversal in registry even when it resolves inside examples', async t => {
  const s = await sandbox(t), f = await fixture(s)
  const p = path.join(f.sourceRepo, 'registry/skills/accessibility-audit.json')
  const entry = JSON.parse(await fs.readFile(p)); entry.source.primaryFile = 'examples/release-notes-writer/../accessibility-audit/SKILL.md'
  await fs.writeFile(p, JSON.stringify(entry))
  assert.notEqual(f.run().status, 0)
})
test('refuses existing empty or populated destinations without overwriting', async t => {
  const s = await sandbox(t), f = await fixture(s)
  const target = path.join(s.project, '.agents/skills/accessibility-audit')
  await fs.mkdir(target, { recursive: true })
  assert.notEqual(f.run().status, 0)
  await fs.writeFile(path.join(target, 'mine.txt'), 'keep')
  assert.notEqual(f.run().status, 0)
  assert.deepEqual(await tree(target), { 'mine.txt': Buffer.from('keep').toString('base64') })
})
test('rejects symlink source and destination components', { skip: process.platform === 'win32' }, async t => {
  const s = await sandbox(t), f = await fixture(s)
  await fs.symlink(path.join(f.source, 'SKILL.md'), path.join(f.source, 'linked.md'))
  assert.notEqual(f.run().status, 0)
  await fs.unlink(path.join(f.source, 'linked.md'))
  await fs.symlink(s.home, path.join(s.project, '.agents'))
  assert.notEqual(f.run().status, 0)
  assert.deepEqual(await fs.readdir(s.home), [])
})
test('rejects special files without blocking', { skip: process.platform === 'win32' }, async t => {
  const s = await sandbox(t), f = await fixture(s)
  assert.equal(spawnSync('mkfifo', [path.join(f.source, 'pipe')]).status, 0)
  const r = f.run(); assert.notEqual(r.status, 0)
})
test('rejects recognizable embedded private keys', async t => {
  const s = await sandbox(t), f = await fixture(s)
  await fs.writeFile(path.join(f.source, 'notes.md'), '-----BEGIN ' + 'PRIVATE KEY-----\nfixture')
  assert.notEqual(f.run().status, 0)
})
test('concurrent installers reserve destination exclusively', async t => {
  const s = await sandbox(t)
  const { spawn } = await import('node:child_process')
  const run = () => new Promise(resolve => {
    const child = spawn(process.execPath, [script, '--skill', 'accessibility-audit', '--agent', 'codex', '--scope', 'project'], { cwd: s.project, env: s.env, stdio: 'ignore' })
    child.on('exit', resolve)
  })
  assert.deepEqual((await Promise.all([run(), run(), run()])).sort(), [0, 1, 1])
  assert.deepEqual(await fs.readdir(path.join(s.project, '.agents/skills')), ['accessibility-audit'])
  assert.deepEqual(await tree(path.join(s.project, '.agents/skills/accessibility-audit')), await tree(path.join(repo, 'examples/accessibility-audit')))
})
test('rename failure removes only this transaction and its staging', async t => {
  const s = await sandbox(t)
  const hook = path.join(s.root, 'fail rename#qa.mjs')
  await fs.writeFile(hook, "import fs from 'node:fs/promises'; fs.rename = async () => { throw Error('injected rename failure') }")
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(hook).href, script, '--skill', 'accessibility-audit', '--agent', 'codex', '--scope', 'project'], { cwd: s.project, env: s.env, encoding: 'utf8' })
  assert.notEqual(r.status, 0); assert.match(r.stderr, /injected rename failure/)
  assert.deepEqual(await fs.readdir(path.join(s.project, '.agents/skills')), [])
})
test('uses explicit Hermes home and XDG config without consulting sticky profiles', async t => {
  const s = await sandbox(t)
  for (const [client, key, value, suffix] of [['hermes', 'HERMES_HOME', path.join(s.home, 'active profile'), 'skills'], ['opencode', 'XDG_CONFIG_HOME', path.join(s.home, 'xdg config'), 'opencode/skills']]) {
    const env = { ...s.env, [key]: value, HERMES_PROFILE: 'do-not-touch' }
    const r = spawnSync(process.execPath, [script, '--skill', 'accessibility-audit', '--agent', client, '--scope', 'user'], { cwd: s.project, env, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(await tree(path.join(value, suffix, 'accessibility-audit')), await tree(path.join(repo, 'examples/accessibility-audit')))
  }
  assert.deepEqual((await fs.readdir(s.home)).sort(), ['active profile', 'xdg config'])
})
test('rejects relative or traversal environment roots before normalization', async t => {
  const s = await sandbox(t)
  for (const value of ['relative', path.join(s.home, 'x') + '/../elsewhere']) {
    const r = spawnSync(process.execPath, [script, '--skill', 'accessibility-audit', '--agent', 'hermes', '--scope', 'user'], { cwd: s.project, env: { ...s.env, HERMES_HOME: value }, encoding: 'utf8' })
    assert.notEqual(r.status, 0, r.stdout)
  }
})
test('all published installation commands select one skill and a verified path', async () => {
  for (const id of ['accessibility-audit', 'release-notes-writer']) {
    const entry = JSON.parse(await fs.readFile(path.join(repo, 'registry/skills', id + '.json')))
    assert.equal(entry.installations.length, 13)
    for (const item of entry.installations) {
      assert.ok(item.targetPath.endsWith('/' + id))
      assert.match(item.command, new RegExp(`--skill ${id} --agent ${item.client} --scope ${item.scope}$`))
      assert.equal(item.command.split('\n').length, 2)
      for (const field of ['verify', 'update', 'uninstall']) assert.ok(item[field].description)
      assert.match(item.evidenceUrl, /^https:\/\//)
      assert.equal(item.officialStatus, 'maintainer')
    }
  }
})
export { sandbox, tree, repo, script }
