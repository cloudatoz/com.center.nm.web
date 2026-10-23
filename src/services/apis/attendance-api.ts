import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'
import { childAgeSchema, childTypeConfigSchema } from './children-api'

const attendanceDaySchema = z.object({
  date: z.string(),
  status: z.enum(['present', 'absent']),
  spendTime: z.number().default(1),
  teacherId: z.coerce.string().optional(),
  teacherName: z.string().optional(),
  salaryTeacher: z.number().optional().default(0),
  tuitionFee: z.number().optional().default(0),
  absent: z.boolean().optional().default(false),
  refund: z.number().optional().default(0),
  lessonType: z.string().optional().default('HỌC'),
  notes: z.string().optional(),
  specialSalary: z.number().optional(),
})

const attendanceChildSchema = z.object({
  _id: z.coerce.string(),
  order: z.number().optional().default(0),
  name: z.string(),
  avatar: z.string().optional().default(''),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().default(''),
  fatherName: z.string().optional().default(''),
  motherName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  address: z.string().optional().default(''),
  description: z.string().optional().default(''),
  planLink: z.string().optional().default(''),
  status: z.enum(['DANG_HOC', 'NGHI_HOC']).optional().default('DANG_HOC'),
  offAt: z.string().optional().nullable(),
  type: z.array(childTypeConfigSchema).default([]),
  isInvoice: z.boolean().optional().default(false),
  isSend: z.array(z.string()).optional().default([]),
  ages: z.array(childAgeSchema).optional().default([]),
  invoiceAmount: z.number().optional().default(3240000),
})

const monthlyAttendanceSchema = z.object({
  _id: z.string(),
  children: z.union([attendanceChildSchema, z.coerce.string()]),
  month: z.string(),
  type: z.preprocess((value) => value === 'BAN_TRU' ? 'CA_NGAY' : value, z.enum(['THEO_BUOI', 'CA_NGAY', 'TAI_NHA', 'SHADOW'])),
  days: z.array(attendanceDaySchema).default([]),
  note: z.string().optional().default(''),
  isCompleted: z.boolean().default(false),
})

export type MonthlyAttendance = z.infer<typeof monthlyAttendanceSchema>

function parseMonthlyAttendance(body: unknown): MonthlyAttendance {
  const parsed = monthlyAttendanceSchema.safeParse(unwrapPayload<unknown>(body))
  if (!parsed.success) throw new ApiContractError('Dữ liệu điểm danh không đúng định dạng')
  return parsed.data
}

export type AttendanceType = 'THEO_BUOI' | 'CA_NGAY' | 'TAI_NHA' | 'SHADOW'

export async function getChildMonthlyAttendance(childId: string, month: string, type: AttendanceType) {
  const response = await apiClient.get(`/v1/attendance/children/${childId}`, {
    params: { month, type },
  })
  const parsed = z.array(monthlyAttendanceSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu điểm danh không đúng định dạng')
  return parsed.data.find((attendance) => attendance.month === month && attendance.type === type) || null
}

export async function getMonthlyAttendances(month: string, type?: AttendanceType | 'ALL', includeChildren = true) {
  const [year, monthNumber] = month.split('-')
  const response = await apiClient.get(`/v1/attendance/monthly/${Number(monthNumber)}/${year}`, {
    params: {
      ...(type && type !== 'ALL' ? { type } : {}),
      ...(!includeChildren ? { includeChildren: 'false' } : {}),
    },
  })
  const parsed = z.array(monthlyAttendanceSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu trạng thái điểm danh không đúng định dạng')
  return parsed.data
}

export async function createAttendance(childId: string, date: string, spendTime: number, type: AttendanceType, teacherId?: string, salaryTeacher?: number, tuitionFee?: number) {
  const response = await apiClient.post('/v1/attendance', {
    children: Number(childId), date, status: 'present', spendTime, type,
    ...(teacherId ? { teacherId: Number(teacherId) } : {}),
    ...(salaryTeacher !== undefined ? { salaryTeacher } : {}),
    ...(tuitionFee !== undefined ? { tuitionFee } : {}),
  })
  return parseMonthlyAttendance(response.data)
}

export async function deleteAttendanceDay(childId: string, date: string, type: AttendanceType) {
  const response = await apiClient.delete(`/v1/attendance/by-date/${childId}`, { data: { date, type } })
  return parseMonthlyAttendance(response.data)
}

export async function updateAttendanceDay(id: string, date: string, spendTime: number, teacherId?: string, absent = false, refund = 0, notes = '', lessonType = 'HỌC') {
  const response = await apiClient.put(`/v1/attendance/update/${id}`, { date, spendTime, absent, refund, notes, lessonType, ...(teacherId && !absent ? { teacherId: Number(teacherId) } : {}) })
  return parseMonthlyAttendance(response.data)
}

export async function setAttendanceCompleted(id: string, isCompleted: boolean) {
  const response = await apiClient.put(`/v1/attendance/${id}`, { isCompleted })
  return parseMonthlyAttendance(response.data)
}

export async function updateAttendanceNote(id: string, note: string) {
  const response = await apiClient.put(`/v1/attendance/${id}`, { note })
  return parseMonthlyAttendance(response.data)
}
