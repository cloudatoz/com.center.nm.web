import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { VITE_API_URL } from '@/config'
import { clearStoredSession, getStoredSession } from '@/services/storage'

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode = 0,
    public code = 'REQUEST_FAILED',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiContractError'
  }
}

export const apiClient = axios.create({
  baseURL: `${VITE_API_URL}/api`,
  headers: { 'content-type': 'application/json' },
  timeout: 30_000,
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredSession()?.token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { code?: string; message?: string }; message?: string }>) => {
    if (error.response?.status === 401) clearStoredSession()
    throw new ApiError(
      error.response?.data?.error?.message || error.response?.data?.message || error.message,
      error.response?.status || 0,
      error.response?.data?.error?.code,
    )
  },
)

export function unwrapPayload<T>(body: unknown): T {
  if (!body || typeof body !== 'object') return body as T
  const record = body as Record<string, unknown>
  if (record.isSuccess === false) {
    const error = (record.error || {}) as Record<string, unknown>
    throw new ApiError(String(error.message || 'Request failed'), Number(record.statusCode || 0))
  }
  if ('data' in record) return record.data as T
  if ('result' in record) return record.result as T
  return body as T
}
