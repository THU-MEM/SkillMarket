import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const registryRoot = path.join(root, 'registry')
const schemaPath = path.join(registryRoot, 'registry.schema.json')
const typeFolders = new Set(['skills', 'agents', 'prompts'])

export async function loadEntries(directory = registryRoot) {
  const entries = []
  const folders = await readdir(directory, { withFileTypes: true })

  for (const folder of folders) {
    if (!folder.isDirectory() || !typeFolders.has(folder.name)) continue
    const files = await readdir(path.join(directory, folder.name), { withFileTypes: true })

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue
      const filePath = path.join(directory, folder.name, file.name)
      let entry
      try {
        entry = JSON.parse(await readFile(filePath, 'utf8'))
      } catch (error) {
        throw new Error(`${path.relative(root, filePath)}: invalid JSON (${error.message})`)
      }
      entries.push({ entry, filePath, folder: folder.name })
    }
  }

  return entries
}

export async function validateRegistry(directory = registryRoot) {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const loaded = await loadEntries(directory)
  const errors = []
  const ids = new Map()

  if (loaded.length === 0) errors.push('registry: at least one entry is required')

  for (const { entry, filePath, folder } of loaded) {
    const relative = path.relative(root, filePath)
    if (!validate(entry)) {
      for (const issue of validate.errors ?? []) {
        errors.push(`${relative}${issue.instancePath || ''}: ${issue.message}`)
      }
    }

    const expectedFolder = `${entry.type}s`
    if (typeFolders.has(expectedFolder) && folder !== expectedFolder) {
      errors.push(`${relative}: type "${entry.type}" must be stored in registry/${expectedFolder}`)
    }

    if (entry.id) {
      const previous = ids.get(entry.id)
      if (previous) errors.push(`${relative}: duplicate id "${entry.id}" (also in ${previous})`)
      else ids.set(entry.id, relative)

      if (path.basename(filePath, '.json') !== entry.id) {
        errors.push(`${relative}: filename must match id "${entry.id}.json"`)
      }
    }
  }

  return { count: loaded.length, errors }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateRegistry()
  if (result.errors.length > 0) {
    console.error(`Registry validation failed with ${result.errors.length} error(s):`)
    for (const error of result.errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log(`Registry validation passed for ${result.count} entries.`)
  }
}
