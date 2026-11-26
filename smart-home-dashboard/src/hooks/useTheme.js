import { useCallback, useState } from 'react'

const KEY = 'smart-home-theme'
const apply = (theme) => { document.documentElement.dataset.theme = theme }

export function initTheme() {
  let saved = 'dark'
  try { saved = localStorage.getItem(KEY) || 'dark' } catch { /* storage blocked */ }
  apply(saved)
  return saved
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || 'dark')
  const setTheme = useCallback((next) => {
    apply(next)
    setThemeState(next)
    try { localStorage.setItem(KEY, next) } catch { /* storage blocked */ }
  }, [])
  return { theme, setTheme }
}
