import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repo = fileURLToPath(new URL('../', import.meta.url))
const upstreamRepos = {
  'open-source-contributor': 'KAIWU-AI/AI-quick-learn',
  '3d-video': 'KAIWU-AI/AI-quick-learn',
  'piano-go': 'hydraxman/PianoGo',
}
const ids = Object.keys(upstreamRepos)
for (const id of ids) {
  test(`${id} uses pinned upstream sources and explicit installer semantics`, async () => {
    const e = JSON.parse(await fs.readFile(path.join(repo, 'registry/skills', `${id}.json`)))
    assert.equal(e.isExample, false)
    assert.equal(e.source.primaryFile, `skills/${id}/SKILL.md`)
    const match = e.source.sourceUrl.match(new RegExp(`^https://github.com/${upstreamRepos[id]}/blob/([0-9a-f]{40})/skills/${id}/SKILL.md$`))
    assert.ok(match)
    const source = `https://github.com/${upstreamRepos[id]}/tree/${match[1]}/skills/${id}`
    assert.equal(e.repository, source)
    assert.equal(e.installations.length, 12)
    const interactive = e.installations.find(m => m.client === 'universal')
    assert.equal(interactive.scope, 'interactive')
    assert.equal(interactive.recommended, true)
    assert.equal(interactive.command, `npx skills@1.7.0 add ${source} --skill ${id} --copy`)
    for (const m of e.installations) {
      assert.equal(m.officialStatus, 'community')
      assert.ok(m.securityNote.includes('覆盖'))
      assert.ok(m.prerequisites.some(p => p.name.includes('22.20')))
      assert.ok(!m.command.includes('.skillmarket-install'))
      assert.ok(m.command.startsWith(interactive.command))
      if (m.client !== 'universal') {
        const agent = m.client === 'hermes' ? 'hermes-agent' : m.client
        assert.equal(m.command, `${interactive.command} --agent ${agent} --yes${m.scope === 'user' ? ' --global' : ''}`)
        if (m.client === 'hermes') assert.equal(m.scope, 'user')
      }
    }
    if (id === 'piano-go') {
      assert.equal(e.license, 'LicenseRef-Mixed')
      assert.match(e.usage.instructions, /songs\//)
      assert.match(JSON.stringify(e), /Python 3.12/)
      assert.match(JSON.stringify(e), /无需 npm install/)
    }
    if (id === '3d-video') {
      assert.equal(e.license, 'LicenseRef-Mixed')
      assert.ok(JSON.stringify(e).includes('素材许可'))
    }
  })
}

test('maintainer installer refuses upstream entries without creating target files', async t => {
  const temp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'upstream-refusal-')))
  t.after(() => fs.rm(temp, { recursive: true, force: true }))
  const home = path.join(temp, 'home'), project = path.join(temp, 'project')
  await fs.mkdir(home); await fs.mkdir(project)
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, '.config'), HERMES_HOME: path.join(home, '.hermes') }
  for (const id of ids) {
    const result = spawnSync(process.execPath, [path.join(repo, 'scripts/install-skill.mjs'), '--skill', id, '--agent', 'claude-code', '--scope', 'project'], { env, cwd: project, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Only registered first-party/)
  }
  assert.deepEqual(await fs.readdir(project), [])
  assert.deepEqual(await fs.readdir(home), [])
})
