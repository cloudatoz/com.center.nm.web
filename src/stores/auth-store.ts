import { create } from 'zustand'
import { clearStoredSession, getStoredSession, setStoredSession } from '@/services/storage'
import type { AuthSession } from '@/types'

interface AuthState {
  session: AuthSession | null
  hydrated: boolean
  setSession: (session: AuthSession) => void
  clearSession: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,
  setSession: (session) => {
    setStoredSession(session)
    set({ session })
  },
  clearSession: () => {
    clearStoredSession()
    set({ session: null })
  },
  hydrate: () => set({ session: getStoredSession(), hydrated: true }),
}))

export function useAuthSession(): AuthSession {
  const session = useAuthStore((state) => state.session)
  if (!session) throw new Error('Authenticated admin session is required for this route')
  return session
}
