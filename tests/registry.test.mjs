import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { validateRegistry } from '../scripts/validate-registry.mjs'

const makeSkillEntry = () => ({
  id: 'duplicate-demo',
  type: 'skill',
  name: 'Duplicate demo',
  description: 'An intentionally duplicated entry used only by the registry test suite.',
  author: { name: 'SkillMarket contributors' },
  source: {
    primaryFile: 'skills/duplicate-demo/SKILL.md',
    sourceUrl: 'https://github.com/THU-MEM/SkillMarket/blob/main/examples/demo/SKILL.md'
  },
  repository: 'https://github.com/THU-MEM/SkillMarket',
  tags: ['testing'],
  version: '1.0.0',
  license: 'Apache-2.0',
  updatedAt: '2026-08-06',
  isExample: true,
  installations: [{
    id: 'manual-project',
    type: 'manual',
    label: 'Manual project install',
    summary: 'Copy the reviewed skill into the current test repository.',
    client: 'github-copilot',
    scope: 'project',
    platforms: ['windows', 'macos', 'linux'],
    officialStatus: 'maintainer',
    recommended: true,
    targetPath: '.github/skills/duplicate-demo/SKILL.md',
    steps: [{
      title: 'Copy skill',
      description: 'Copy the complete fixture into the target directory.'
    }],
    evidenceUrl: 'https://github.com/THU-MEM/SkillMarket'
  }],
  usage: { instructions: 'Run the duplicate validation fixture in the automated test suite.' }
})

test('the checked-in registry satisfies the schema and uniqueness rules', async () => {
  const result = await validateRegistry()
  assert.deepEqual(result.errors, [])
  assert.ok(result.count >= 6, 'expected representative entries for all content types')
})

test('duplicate ids are rejected', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skillmarket-registry-'))
  await Promise.all(['skills', 'agents', 'prompts'].map((name) => mkdir(path.join(directory, name))))
  const entry = makeSkillEntry()
  await writeFile(path.join(directory, 'skills', 'duplicate-demo.json'), JSON.stringify(entry))
  await writeFile(path.join(directory, 'skills', 'duplicate-demo-copy.json'), JSON.stringify(entry))

  const result = await validateRegistry(directory)
  assert.ok(result.errors.some((error) => error.includes('duplicate id "duplicate-demo"')))
})

test('duplicate installation method ids are rejected', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'skillmarket-installations-'))
  await Promise.all(['skills', 'agents', 'prompts'].map((name) => mkdir(path.join(directory, name))))
  const entry = makeSkillEntry()
  entry.installations.push({
    ...entry.installations[0],
    label: 'A second method with the same identifier',
    recommended: false
  })
  await writeFile(path.join(directory, 'skills', 'duplicate-demo.json'), JSON.stringify(entry))

  const result = await validateRegistry(directory)
  assert.ok(result.errors.some((error) => error.includes('duplicate installation id "manual-project"')))
})
