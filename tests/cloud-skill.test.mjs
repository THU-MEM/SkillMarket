import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = fileURLToPath(new URL('../', import.meta.url))
const id = 'tsinghua-cloud-drive'
const source = path.join(repo, 'examples', id)
async function tree(dir, prefix = '') {
  const output = {}
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name)
    assert.equal(item.isSymbolicLink(), false)
    if (item.isDirectory()) Object.assign(output, await tree(path.join(dir, item.name), relative))
    else output[relative] = (await fs.readFile(path.join(dir, item.name))).toString('base64')
  }
  return output
}
test('published cloud skill contains only portable runtime files and no account configuration', async () => {
  const files = await tree(source)
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'requirements.txt', 'scripts/drive.py'])
  const text = Object.values(files).map(value => Buffer.from(value, 'base64').toString()).join('\n')
  assert.match(text, /TSINGHUA_CLOUD_TOKEN/)
  assert.match(text, /TSINGHUA_CLOUD_REPO_ID/)
  assert.doesNotMatch(text, /\/Users\/|github_pat_[A-Za-z0-9_]{30,}|ghp_[A-Za-z0-9]{30,}/)
  assert.doesNotMatch(text, /["'][0-9a-fA-F]{40}["']/)
})
test('cloud metadata offers platform-correct setup without embedding credentials', async () => {
  const entry = JSON.parse(await fs.readFile(path.join(repo, 'registry/skills', `${id}.json`)))
  assert.equal(entry.isExample, false)
  assert.equal(entry.source.primaryFile, `examples/${id}/SKILL.md`)
  assert.equal(new Set(entry.installations.map(m => `${m.client}/${m.scope}`)).size, 13)
  for (const method of entry.installations) {
    assert.match(method.command, /--skill tsinghua-cloud-drive /)
    const setup = method.steps.find(step => step.command?.includes('pip install'))
    assert.ok(setup, 'Dependency installation must be explicit')
    assert.ok(method.prerequisites.some(p => p.details.includes('TSINGHUA_CLOUD_TOKEN')))
    if (method.platforms.includes('windows')) assert.match(setup.command, /^py -3 /)
    else assert.match(setup.command, /^python3 /)
  }
})
test('all advertised cloud destinations receive the complete byte-identical skill without execution', async () => {
  const entry = JSON.parse(await fs.readFile(path.join(repo, 'registry/skills', `${id}.json`)))
  const pairs = [...new Map(entry.installations.map(m => [`${m.client}/${m.scope}`, m])).values()]
  const expected = await tree(source)
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-skill-install-')))
  try {
    for (const [index, method] of pairs.entries()) {
      const root = path.join(temp, String(index)), project = path.join(root, 'project'), home = path.join(root, 'home')
      await fs.mkdir(project, { recursive: true }); await fs.mkdir(home)
      const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config'), HERMES_HOME: path.join(home, '.hermes') }
      for (const key of Object.keys(env)) if (key.startsWith('TSINGHUA_CLOUD_')) delete env[key]
      const args = [path.join(repo, 'scripts/install-skill.mjs'), '--skill', id, '--agent', method.client, '--scope', method.scope]
      const result = spawnSync(process.execPath, args, { cwd: project, env, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      const receipt = JSON.parse(result.stdout)
      assert.equal(receipt.scriptsExecuted, false)
      assert.deepEqual(await tree(receipt.target), expected)
      assert.notEqual(spawnSync(process.execPath, args, { cwd: project, env, encoding: 'utf8' }).status, 0)
    }
  } finally { await fs.rm(temp, { recursive: true, force: true }) }
})
