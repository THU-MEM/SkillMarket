#!/usr/bin/env node
import fs from 'node:fs/promises'
import { constants } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const clients = { 'claude-code': '.claude/skills', codex: '.agents/skills', cursor: '.cursor/skills', opencode: '.opencode/skills', 'github-copilot': '.github/skills', 'github-copilot-cli': '.github/skills', hermes: null }
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const forbidden = /^(?:\.env.*|\.git|\.ssh|\.aws|\.azure|\.npmrc|\.pypirc|\.netrc|node_modules|\.?venv|__pycache__|.*cache.*|dist|build|coverage|credentials(?:\..*)?|auth\.json|secrets?(?:\..*)?|id_(?:rsa|ed25519|ecdsa)|.*\.(?:pem|key|p12|pfx|pyc))$/i
const secret = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{32,})\b/
async function stat(p) {
  try { return await fs.lstat(p) } catch (e) { if (e.code === 'ENOENT') return null; throw e }
}
async function safePath(p) {
  if (!path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) throw Error(`Absolute path without traversal required: ${p}`)
  const parts = path.relative(path.parse(p).root, p).split(path.sep).filter(Boolean)
  let current = path.parse(p).root
  for (const part of parts) {
    current = path.join(current, part)
    const info = await stat(current)
    if (info && (!info.isDirectory() || info.isSymbolicLink())) throw Error(`Unsafe directory component: ${current}`)
  }
}
async function snapshot(source) {
  const files = [], dirs = []
  let bytes = 0
  async function visit(dir, relative = '') {
    await safePath(dir)
    for (const name of (await fs.readdir(dir)).sort()) {
      if (forbidden.test(name) || /[\\<>:"|?*\x00-\x1f]/.test(name) || /[. ]$/.test(name) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) throw Error(`Forbidden source name: ${name}`)
      const p = path.join(dir, name), rel = path.join(relative, name), info = await fs.lstat(p)
      if (info.isSymbolicLink() || (!info.isDirectory() && !info.isFile())) throw Error(`Symlink or special file: ${rel}`)
      if (info.isDirectory()) { dirs.push(rel); await visit(p, rel) }
      else {
        if (info.nlink !== 1) throw Error(`Hard-linked source: ${rel}`)
        bytes += info.size
        if (bytes > 32 * 1024 * 1024) throw Error('Skill exceeds 32 MiB safety limit')
        const handle = await fs.open(p, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
        let data
        try {
          const opened = await handle.stat()
          if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev) throw Error(`Source changed: ${rel}`)
          data = await handle.readFile()
        } finally { await handle.close() }
        if (secret.test(data.toString('utf8'))) throw Error(`Possible embedded credential: ${rel}`)
        files.push({ rel, data, mode: info.mode & 0o777 })
      }
    }
  }
  await visit(source)
  if (!files.some(f => f.rel === 'SKILL.md')) throw Error('Missing SKILL.md')
  return { files, dirs }
}
async function publish(root, target, content) {
  await safePath(root)
  if (await stat(target)) throw Error(`Target already exists; refusing overwrite: ${target}`)
  await fs.mkdir(root, { recursive: true })
  await safePath(root)
  const staging = await fs.mkdtemp(path.join(root, '.skillmarket-stage-'))
  let reserved = false
  try {
    for (const dir of content.dirs) await fs.mkdir(path.join(staging, dir), { recursive: true })
    for (const f of content.files) await fs.writeFile(path.join(staging, f.rel), f.data, { flag: 'wx', mode: f.mode })
    await safePath(root)
    // mkdir is the portable exclusive reservation; rename alone can replace an empty directory.
    await fs.mkdir(target)
    reserved = true
    // Publish SKILL.md last, so discovery cannot observe an incomplete skill.
    const names = (await fs.readdir(staging)).filter(n => n !== 'SKILL.md')
    names.push('SKILL.md')
    for (const name of names) await fs.rename(path.join(staging, name), path.join(target, name))
  } catch (e) {
    if (reserved) await fs.rm(target, { recursive: true, force: true })
    throw e
  } finally { await fs.rm(staging, { recursive: true, force: true }) }
}
function parse(args) {
  const options = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (!['--skill', '--agent', '--scope', '--list', '--dry-run'].includes(key) || key in options) throw Error(`Unknown or duplicate option: ${key}`)
    options[key] = ['--list', '--dry-run'].includes(key) ? true : args[++i]
    if (!options[key] || String(options[key]).startsWith('--')) throw Error(`Missing value: ${key}`)
  }
  if (options['--list']) {
    if (Object.keys(options).length !== 1) throw Error('--list cannot be combined with installation options')
  } else if (!slug.test(options['--skill'] || '') || !Object.hasOwn(clients, options['--agent']) || !['project', 'user'].includes(options['--scope'])) throw Error('Use --skill ID --agent CLIENT --scope project|user (or --list)')
  return options
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw Error('Node.js >=22 required')
  const o = parse(process.argv.slice(2))
  if (o['--list']) {
    console.log(JSON.stringify({ skills: (await fs.readdir(path.join(repo, 'registry/skills'))).filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort(), clients: Object.keys(clients) }))
    return
  }
  const id = o['--skill'], client = o['--agent'], scope = o['--scope']
  if (client === 'hermes' && scope !== 'user') throw Error('Hermes supports only user scope in this installer')
  const home = os.homedir()
  let root = path.join(scope === 'project' ? process.cwd() : home, clients[client] || '')
  if (scope === 'user') {
    const override = client === 'hermes' ? process.env.HERMES_HOME : client === 'opencode' ? process.env.XDG_CONFIG_HOME : undefined
    if (override) await safePath(override)
    if (client.startsWith('github-copilot')) root = path.join(home, '.copilot/skills')
    if (client === 'opencode') root = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode/skills')
    if (client === 'hermes') root = path.join(process.env.HERMES_HOME || path.join(home, '.hermes'), 'skills')
  }
  const registryDir = path.join(repo, 'registry/skills')
  await safePath(registryDir)
  const record = path.join(registryDir, id + '.json')
  const recordInfo = await fs.lstat(record)
  if (!recordInfo.isFile() || recordInfo.isSymbolicLink()) throw Error('Invalid registry file')
  const entry = JSON.parse(await fs.readFile(record, 'utf8'))
  if (entry.type !== 'skill' || entry.id !== id || entry.source?.primaryFile !== `examples/${id}/SKILL.md` || entry.source?.sourceUrl !== `https://github.com/THU-MEM/SkillMarket/blob/main/examples/${id}/SKILL.md`) throw Error('Only registered first-party examples/<ID>/SKILL.md sources are supported')
  const source = path.join(repo, 'examples', id)
  const content = await snapshot(source)
  const target = path.join(root, id)
  await safePath(root)
  if (await stat(target)) throw Error(`Target already exists; refusing overwrite: ${target}`)
  if (!o['--dry-run']) await publish(root, target, content)
  console.log(JSON.stringify({ skill: id, client, scope, source, target, dryRun: Boolean(o['--dry-run']), scriptsExecuted: false }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
