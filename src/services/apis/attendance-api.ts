import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const attendanceDaySchema = z.object({
  date: z.string(),
  status: z.enum(['present', 'absent']),
  spendTime: z.number().default(1),
  teacherId: z.coerce.string().optional(),
  teacherName: z.string().optional(),
  salaryTeacher: z.number().optional().default(0),
  tuitionFee: z.number().optional().default(0),
  notes: z.string().optional(),
  specialSalary: z.number().optional(),
})

const attendanceChildSchema = z.object({
  _id: z.coerce.string(),
  name: z.string(),
  avatar: z.string().optional().default(''),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().default(''),
  type: z.union([z.array(z.string()), z.string()]).optional().default([]),
  salaryTeacher: z.number().optional().default(0),
  tuitionFee: z.number().optional().default(0),
  salaryOneHourForCenter: z.number().optional().default(0),
  mealFee: z.number().optional().default(0),
  csvcFee: z.number().optional().default(0),
  drawingFee: z.number().optional().default(0),
  languageFee: z.number().optional().default(0),
  movementFee: z.number().optional().default(0),
  teacherId: z.coerce.string().optional().nullable(),
  teacherName: z.string().optional().default(''),
})

const monthlyAttendanceSchema = z.object({
  _id: z.string(),
  children: z.union([attendanceChildSchema, z.coerce.string()]),
  month: z.string(),
  type: z.enum(['THEO_BUOI', 'BAN_TRU']),
  days: z.array(attendanceDaySchema).default([]),
  isCompleted: z.boolean().default(false),
})

export type MonthlyAttendance = z.infer<typeof monthlyAttendanceSchema>

function parseMonthlyAttendance(body: unknown): MonthlyAttendance {
  const parsed = monthlyAttendanceSchema.safeParse(unwrapPayload<unknown>(body))
  if (!parsed.success) throw new ApiContractError('Dữ liệu điểm danh không đúng định dạng')
  return parsed.data
}

export type AttendanceType = 'THEO_BUOI' | 'BAN_TRU'

export async function getChildMonthlyAttendance(childId: string, month: string, type: AttendanceType) {
  const response = await apiClient.get(`/v1/attendance/children/${childId}`, {
    params: { month, type },
  })
  const parsed = z.array(monthlyAttendanceSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu điểm danh không đúng định dạng')
  return parsed.data.find((attendance) => attendance.month === month && attendance.type === type) || null
}

export async function getMonthlyAttendances(month: string, type?: AttendanceType | 'ALL') {
  const [year, monthNumber] = month.split('-')
  const response = await apiClient.get(`/v1/attendance/monthly/${Number(monthNumber)}/${year}`, {
    params: type && type !== 'ALL' ? { type } : undefined,
  })
  const parsed = z.array(monthlyAttendanceSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu trạng thái điểm danh không đúng định dạng')
  return parsed.data
}

export async function createAttendance(childId: string, date: string, spendTime: number, type: AttendanceType, teacherId?: string) {
  const response = await apiClient.post('/v1/attendance', {
    children: Number(childId), date, status: 'present', spendTime, type,
    ...(teacherId ? { teacherId: Number(teacherId) } : {}),
  })
  return parseMonthlyAttendance(response.data)
}

export async function deleteAttendanceDay(childId: string, date: string, type: AttendanceType) {
  await apiClient.delete(`/v1/attendance/by-date/${childId}`, { data: { date, type } })
}

export async function updateAttendanceDay(id: string, date: string, spendTime: number, teacherId?: string) {
  const response = await apiClient.put(`/v1/attendance/update/${id}`, { date, spendTime, ...(teacherId ? { teacherId: Number(teacherId) } : {}) })
  return parseMonthlyAttendance(response.data)
}

export async function setAttendanceCompleted(id: string, isCompleted: boolean) {
  const response = await apiClient.put(`/v1/attendance/${id}`, { isCompleted })
  return parseMonthlyAttendance(response.data)
}
