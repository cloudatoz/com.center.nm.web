import type { AuthSession, ThemeMode } from '@/types'

const SESSION_KEY = 'vg.admin.session.v1'
const THEME_KEY = 'vg.admin.theme'

export function getStoredSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? (JSON.parse(value) as AuthSession) : null
  } catch {
    return null
  }
}

export function setStoredSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getStoredTheme(): ThemeMode {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'dark' ? 'dark' : 'light'
}

export function setStoredTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme)
}
