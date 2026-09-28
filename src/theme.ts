export type Theme = 'light' | 'dark'
export const THEME_KEY = 'skillmarket-hero-theme'
type StorageSource = () => Pick<Storage, 'getItem' | 'setItem'>
const browserStorage: StorageSource = () => window.localStorage
export function readTheme(source: StorageSource = browserStorage): Theme {
  try { return source().getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}
export function saveTheme(theme: Theme, source: StorageSource = browserStorage): boolean {
  try { source().setItem(THEME_KEY, theme); return true } catch { return false }
}
export function applyTheme(theme: Theme, root: Pick<HTMLElement, 'classList' | 'dataset'> = document.documentElement) {
  root.classList.remove('light', 'dark'); root.classList.add(theme); root.dataset.theme = theme
}
