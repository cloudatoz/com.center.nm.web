import { create } from 'zustand'
import { getStoredTheme, setStoredTheme } from '@/services/storage'
import type { ThemeMode } from '@/types'

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

interface ThemeState {
  theme: ThemeMode
  hydrate: () => void
  setTheme: (theme: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  hydrate: () => {
    const theme = getStoredTheme()
    applyTheme(theme)
    set({ theme })
  },
  setTheme: (theme: ThemeMode) => {
    setStoredTheme(theme)
    applyTheme(theme)
    set({ theme })
  },
}))
