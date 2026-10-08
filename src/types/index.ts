export type ThemeMode = 'light' | 'dark'

export type AdminRole = 'superadmin' | 'admin' | 'operator' | 'auditor'

export interface AdminUser {
  id: string | number
  email: string
  name: string
  role: AdminRole | string
  active: boolean
  avatar?: string
  lastLogin?: string
  createdAt?: string
}

export interface AuthSession {
  token: string
  user: AdminUser
}
