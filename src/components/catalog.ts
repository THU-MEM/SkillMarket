import type { EntryType, Installation, RegistryEntry } from '../types'
export const tagLabels: Record<string, string> = {
  accessibility: '无障碍', architecture: '架构', community: '社区', 'code-review': '代码审查',
  'decision-making': '决策', dependencies: '依赖管理', 'developer-tools': '开发工具', documentation: '文档',
  frontend: '前端', github: 'GitHub', maintenance: '维护', quality: '质量', release: '发布', security: '安全', triage: '问题分诊',
}
export const displayTag = (tag: string) => tagLabels[tag] ?? tag
export type Sort = 'newest' | 'oldest' | 'name'
export function filterEntries(entries: RegistryEntry[], query: string, type: EntryType | 'all', tags: string[], sort: Sort) {
  const term = query.trim().toLocaleLowerCase()
  return entries.filter(e => (type === 'all' || e.type === type) && tags.every(t => e.tags.includes(t)) &&
    [e.name, e.description, e.author.name, ...e.tags, ...e.tags.map(displayTag)].join(' ').toLocaleLowerCase().includes(term))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : (sort === 'newest' ? -1 : 1) * a.updatedAt.localeCompare(b.updatedAt))
}
export type Platform = Installation['platforms'][number]
export function platformMethods(methods: Installation[], platform: Platform) {
  return methods.filter(m => m.platforms.includes(platform))
}
export const clientLabels: Record<string, string> = {
  'github-copilot': 'GitHub Copilot', 'github-copilot-cli': 'Copilot CLI', 'claude-code': 'Claude Code',
  codex: 'Codex', cursor: 'Cursor', opencode: 'OpenCode', hermes: 'Hermes', universal: '通用 / 手动',
}
