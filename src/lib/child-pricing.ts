import type { Child, ChildTypeCode, ChildTypeConfig } from '@/services/apis/children-api'
import type { AttendanceType } from '@/services/apis/attendance-api'

export const CHILD_TYPE_OPTIONS: { type: ChildTypeCode; label: string }[] = [
  { type: 'CA_NGAY', label: 'Cả ngày' },
  { type: 'CA_NHAN', label: 'Cá nhân' },
  { type: 'TAI_NHA', label: 'Tại nhà' },
  { type: 'SHADOW', label: 'Shadow' },
  { type: 'CA_NHAN_DRAW', label: 'Vẽ' },
  { type: 'CA_NHAN_LANGUAGE', label: 'Ngoại ngữ' },
  { type: 'CA_NHAN_MOVEMENT', label: 'Vận động' },
]

export const childTypeLabel = (type: ChildTypeCode) =>
  CHILD_TYPE_OPTIONS.find((item) => item.type === type)?.label || type

export function getTypeConfig(child: Pick<Child, 'type'> | null | undefined, type: ChildTypeCode) {
  return child?.type.find((item) => item.type === type)
}

export function lessonConfigType(lessonType = 'HỌC'): ChildTypeCode {
  const value = lessonType.trim().toLocaleUpperCase('vi')
  if (value.includes('VẼ')) return 'CA_NHAN_DRAW'
  if (value.includes('NGOẠI NGỮ') || value.includes('NGÔN NGỮ')) return 'CA_NHAN_LANGUAGE'
  if (value.includes('VẬN ĐỘNG')) return 'CA_NHAN_MOVEMENT'
  return 'CA_NHAN'
}

export function configForAttendance(child: Pick<Child, 'type'> | null | undefined, attendanceType: AttendanceType, lessonType?: string) {
  const type = attendanceType === 'THEO_BUOI' ? lessonConfigType(lessonType) : attendanceType
  return getTypeConfig(child, type) || (attendanceType === 'THEO_BUOI' ? getTypeConfig(child, 'CA_NHAN') : undefined)
}

const DAY_NAMES = ['chủ nhật', 'thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7']

export function scheduleForDate(config: ChildTypeConfig | null | undefined, date: string) {
  if (!config?.schedules.length) return undefined
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  const dayName = DAY_NAMES[new Date(year, month - 1, day).getDay()]
  return config.schedules.find((schedule) => schedule.scheduleInWeek.includes(dayName)) || config.schedules[0]
}

export function supportsAttendanceType(child: Pick<Child, 'type'>, attendanceType: AttendanceType) {
  if (attendanceType === 'THEO_BUOI') return child.type.some((item) => item.type.startsWith('CA_NHAN'))
  return child.type.some((item) => item.type === attendanceType)
}

export const emptyTypeConfig = (type: ChildTypeCode): ChildTypeConfig => ({
  type,
  price: 0,
  prices: { tuition: 0, csvc: 0, meal: 0 },
  teacherId: null,
  teacherName: '',
  teacherPrice: 0,
  scheduleInWeek: [],
  schedules: [],
})

export function boardingTotal(child: Pick<Child, 'type'> | null | undefined) {
  const prices = getTypeConfig(child, 'CA_NGAY')?.prices
  return (prices?.tuition || 0) + (prices?.csvc || 0) + (prices?.meal || 0)
}
