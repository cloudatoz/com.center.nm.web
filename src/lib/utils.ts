import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`
}

export function formatNumberWithDots(value: number | string): string {
  if (value === '' || value === null || value === undefined) return ''
  const cleanStr = String(value).replace(/\D/g, '')
  if (!cleanStr) return ''
  const num = Number.parseInt(cleanStr, 10)
  if (Number.isNaN(num)) return ''
  return new Intl.NumberFormat('vi-VN').format(num)
}

export function parseDotFormattedNumber(value: string): number {
  const cleanStr = String(value).replace(/\D/g, '')
  return Number.parseInt(cleanStr, 10) || 0
}
