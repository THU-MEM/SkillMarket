import type { EntryType } from '../types'
import type { Sort } from './catalog'
import { clientLabels } from './catalog'

export type CatalogState = { query: string; type: EntryType | 'all'; selectedTags: string[]; sort: Sort }
export function readCatalogState(hash: string, knownTags: readonly string[]): CatalogState {
  const params = new URLSearchParams(hash.split('?')[1] ?? '')
  const type = params.get('type')
  const sort = params.get('sort')
  return {
    query: (params.get('search') ?? '').slice(0, 300),
    type: type === 'skill' || type === 'agent' || type === 'prompt' ? type : 'all',
    selectedTags: [...new Set(params.getAll('tags').flatMap(value => value.split(',')))].filter(tag => knownTags.includes(tag)),
    sort: sort === 'oldest' || sort === 'name' ? sort : 'newest',
  }
}
export function catalogHash(state: CatalogState, path = '', client?: string): string {
  const params = new URLSearchParams()
  if (state.query) params.set('search', state.query)
  if (['skill', 'agent', 'prompt'].includes(state.type)) params.set('type', state.type)
  if (state.selectedTags.length) params.set('tags', state.selectedTags.join(','))
  if (state.sort === 'oldest' || state.sort === 'name') params.set('sort', state.sort)
  if (client && Object.hasOwn(clientLabels, client)) params.set('client', client)
  return `#/${path}${params.size ? `?${params}` : ''}`
}
