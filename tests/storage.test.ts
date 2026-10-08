import { beforeEach, describe, expect, test } from 'bun:test'
import {
  clearStoredSession,
  getStoredSession,
  getStoredTheme,
  setStoredSession,
  setStoredTheme,
} from '../src/services/storage'
import type { AuthSession } from '../src/types'

const session: AuthSession = {
  token: 'admin-live-token',
  user: {
    id: 'admin-1',
    email: 'admin@vego.mobi',
    name: 'Super Admin',
    role: 'superadmin',
    active: true,
  },
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('Admin CMS local storage', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  test('persists and clears the admin bearer session', () => {
    setStoredSession(session)
    expect(getStoredSession()).toEqual(session)
    clearStoredSession()
    expect(getStoredSession()).toBeNull()
  })

  test('accepts supported themes and falls back safely', () => {
    setStoredTheme('dark')
    expect(getStoredTheme()).toBe('dark')
    localStorage.setItem('vg.admin.theme', 'invalid')
    expect(getStoredTheme()).toBe('light')
  })
})
