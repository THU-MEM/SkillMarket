import type { RegistryEntry } from '../types'

// Observed registry snapshots, not installs or activity. Source: THU-MEM/SkillMarket
// 10466d49cddafae2a21fb58594a8d7ca8b491a07 (2026-08-06)
// 9e09669c4345a08cbb13660fd016b95c1be3aa7e (2026-08-07, last sample that day)
export const catalogHistory = [
  { date: '2026-08-06', skill: 2, agent: 2, prompt: 2, total: 6 },
  { date: '2026-08-07', skill: 2, agent: 2, prompt: 2, total: 6 },
] as const

export function catalogMetrics(entries: readonly RegistryEntry[]) {
  const counts = { skill: 0, agent: 0, prompt: 0, total: entries.length }
  for (const entry of entries) counts[entry.type]++
  return { counts, samples: [...catalogHistory, { date: '当前', ...counts }] }
}
