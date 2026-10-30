import { useCallback, useState } from 'react'

export type Theme = 'dark' | 'light'

function readTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Dark by default; the choice is remembered per browser. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  const toggleTheme = useCallback(() => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Storage unavailable (private mode etc.) — theme still applies for this visit
    }
    setTheme(next)
  }, [])

  return { theme, toggleTheme }
}
