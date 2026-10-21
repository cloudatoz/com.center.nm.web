import { z } from 'zod'
import type { AdminUser, AuthSession } from '@/types'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const adminLoginSchema = z.object({
  token: z.string().optional(),
  accessToken: z.string().optional(),
  access_token: z.string().optional(),
  user: z.record(z.string(), z.unknown()).optional(),
  teacher: z.record(z.string(), z.unknown()).optional(),
})

function normalizeAdminSession(body: unknown): AuthSession {
  const payload = unwrapPayload<unknown>(body)
  const parsed = adminLoginSchema.safeParse(payload)
  if (!parsed.success) {
    throw new ApiContractError('Login response does not match a supported contract')
  }

  const token = parsed.data.token || parsed.data.accessToken || parsed.data.access_token
  if (!token) throw new ApiContractError('Login response did not include an access token')

  const rawUser = parsed.data.user || parsed.data.teacher || {}
  const isTeacher = Boolean(parsed.data.teacher)
  const user: AdminUser = {
    id: (rawUser.id as string | number) || (rawUser._id as string | number) || 'admin-1',
    email: String(rawUser.email || ''),
    name: String(rawUser.name || rawUser.email || 'Admin'),
    role: String(rawUser.role || (isTeacher ? 'teacher' : 'superadmin')),
    active: rawUser.active !== undefined ? Boolean(rawUser.active) : true,
    avatar: rawUser.avatar as string | undefined,
    lastLogin: rawUser.lastLogin as string | undefined,
    createdAt: rawUser.createdAt as string | undefined,
  }

  return { token, user }
}

export async function loginTeacherByCode(code: string): Promise<AuthSession> {
  const response = await apiClient.get('/v1/teacher/login-by-code', { params: { code } })
  return normalizeAdminSession(response.data)
}

export async function loginAdmin(email: string, password: string): Promise<AuthSession> {
  const response = await apiClient.post('/v1/user/login', { email, password })
  return normalizeAdminSession(response.data)
}
