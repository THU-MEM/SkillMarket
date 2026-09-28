export type IconName = 'skill' | 'agent' | 'prompt' | 'search' | 'filter' | 'close' | 'arrow' | 'back' | 'copy' | 'check' | 'github' | 'plus' | 'book' | 'terminal' | 'external'
const paths: Record<IconName, string> = {
  skill: 'M9 3H4v6h2a3 3 0 1 1 0 6H4v6h6v-2a3 3 0 1 1 6 0v2h5v-6h-2a3 3 0 1 1 0-6h2V3h-6v2a3 3 0 1 1-6 0Z',
  agent: 'M12 3v3m-2-3h4M5 7h14v13H5zM2 11v5m20-5v5M9 11v2m6-2v2m-6 4h6',
  prompt: 'M4 4h16v12H9l-5 5V4Zm4 4h8m-8 4h5',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  filter: 'M4 7h16M4 17h16M8 4v6m8 4v6', close: 'M6 6l12 12M6 18 18 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6', back: 'M20 12H4m6-6-6 6 6 6',
  copy: 'M9 9h12v12H9zM15 9V3H3v12h6', check: 'm5 12 4 4L19 6',
  github: 'M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.3-2-1-2 4-.4 7-2 7-6 0-2-1-3-2-4 0-1 0-3-1-4-2 0-3 1-4 2-2-.5-4-.5-6 0-1-1-2-2-4-2-1 1-1 3-1 4-1 1-2 2-2 4 0 4 3 6 7 6-.7.5-1 1-1 2v4',
  plus: 'M12 5v14M5 12h14', book: 'M12 5v16M3 3h5l4 2 4-2h5v16h-5l-4 2-4-2H3z',
  terminal: 'm4 5 6 6-6 6m9 0h7', external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
}
export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
