import type { RegistryEntry } from './types'

const modules = import.meta.glob('../registry/{skills,agents,prompts}/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, RegistryEntry>

export const entries = Object.values(modules)

export const entryById = new Map(entries.map((entry) => [entry.id, entry]))

export const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort((a, b) =>
  a.localeCompare(b),
)
