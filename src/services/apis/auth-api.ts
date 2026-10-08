import { z } from 'zod'
import type { AdminUser, AuthSession } from '@/types'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const adminLoginSchema = z.object({
  token: z.string().optional(),
  accessToken: z.string().optional(),
  access_token: z.string().optional(),
  user: z.record(z.string(), z.unknown()).optional(),
})

function normalizeAdminSession(body: unknown): AuthSession {
  const payload = unwrapPayload<unknown>(body)
  const parsed = adminLoginSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiContractError('Login response does not match a supported contract')
  }

  const token = parsed.data.token || parsed.data.accessToken || parsed.data.access_token
  if (!token) throw new ApiContractError('Login response did not include an access token')

  const rawUser = parsed.data.user || {}
  const user: AdminUser = {
    id: (rawUser.id as string | number) || 'admin-1',
    email: String(rawUser.email || ''),
    name: String(rawUser.name || rawUser.email || 'Admin'),
    role: String(rawUser.role || 'superadmin'),
    active: rawUser.active !== undefined ? Boolean(rawUser.active) : true,
    avatar: rawUser.avatar as string | undefined,
    lastLogin: rawUser.lastLogin as string | undefined,
    createdAt: rawUser.createdAt as string | undefined,
  }

  return { token, user }
}

export async function loginAdmin(email: string, password: string): Promise<AuthSession> {
  const response = await apiClient.post('/v1/user/login', { email, password })
  return normalizeAdminSession(response.data)
}

export async function getCurrentAdmin(session: AuthSession): Promise<AuthSession> {
  const response = await apiClient.get('/v1/user/me')
  const payload = unwrapPayload<Record<string, unknown>>(response.data)
  const rawUser = (payload.user || payload) as Record<string, unknown>

  return {
    ...session,
    user: {
      ...session.user,
      id: (rawUser.id as string | number) || session.user.id,
      email: String(rawUser.email || session.user.email),
      name: String(rawUser.name || session.user.name),
      role: String(rawUser.role || session.user.role),
      active: rawUser.active !== undefined ? Boolean(rawUser.active) : session.user.active,
      avatar: (rawUser.avatar as string | undefined) || session.user.avatar,
    },
  }
}
