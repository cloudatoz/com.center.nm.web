import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const teacherSchema = z.object({
  _id: z.coerce.string(),
  account: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  description: z.string().optional().default(''),
  otherSalary: z.number().optional().default(0),
  type: z.preprocess((value) => value === 'BAN_TRU' ? 'CA_NGAY' : value, z.enum(['CA_NGAY', 'THEO_BUOI', 'CA_NHAN', 'TAI_NHA', 'SHADOW'])).optional().default('THEO_BUOI'),
  baseSalary: z.number().optional().default(0),
  insuranceSupport: z.number().optional().default(0),
  isPayInsurance: z.boolean().optional().default(false),
  attendanceBonus: z.number().optional().default(0),
  sessionsPerDay: z.number().optional().default(0),
  isSalaryByMonth: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  accountBank: z.string().optional().default(''),
  nameBank: z.string().optional().default(''),
  createdAt: z.string().optional(),
})

export type Teacher = z.infer<typeof teacherSchema>
export type UpdateTeacherInput = Partial<Omit<Teacher, '_id'>>
export type CreateTeacherInput = Omit<Teacher, '_id' | 'active' | 'createdAt'> & { password: string }

export async function getTeachers(): Promise<Teacher[]> {
  const response = await apiClient.get('/v1/teacher')
  const parsed = z.array(teacherSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu danh sách giáo viên không đúng định dạng')
  return parsed.data
}

export async function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  const response = await apiClient.post('/v1/teacher', input)
  const parsed = teacherSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu giáo viên mới không đúng định dạng')
  return parsed.data
}

export async function updateTeacher(id: string, input: UpdateTeacherInput): Promise<Teacher> {
  const response = await apiClient.put(`/v1/teacher/${id}`, input)
  const parsed = teacherSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu giáo viên sau khi cập nhật không đúng định dạng')
  return parsed.data
}

export async function deleteTeacher(id: string): Promise<void> {
  await apiClient.delete(`/v1/teacher/${id}`)
}

const monthlySalaryItemSchema = z.object({
  teacherId: z.coerce.string(),
  teacherName: z.string(),
  baseSalary: z.number().default(0),
  insuranceSupport: z.number().default(0),
  isPayInsurance: z.boolean().optional().default(false),
  attendanceBonus: z.number().default(0),
  otherSalary: z.number().default(0),
  absents: z.array(z.object({
    date: z.string(),
    isPaidLeave: z.boolean().optional().default(false),
    subSalary: z.number().default(0),
  })).default([]),
  totalSalary: z.number().default(0),
})

const salaryMonthSchema = z.object({
  _id: z.string(),
  salaries: z.array(monthlySalaryItemSchema).default([]),
  totalSalary: z.number().default(0),
})

export type SalaryMonth = z.infer<typeof salaryMonthSchema>

export async function getSalaryMonth(month: string): Promise<SalaryMonth> {
  const response = await apiClient.get(`/v1/salary-month/${month}`)
  const parsed = salaryMonthSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu lương tháng không đúng định dạng')
  return parsed.data
}

export async function updateMonthlySalary(
  month: string,
  teacherId: string,
  input: { baseSalary: number; insuranceSupport: number; attendanceBonus: number; otherSalary: number; absents: Array<{ date: string; isPaidLeave: boolean }> },
): Promise<SalaryMonth> {
  const response = await apiClient.put(`/v1/salary-month/${month}/${teacherId}`, input)
  const parsed = salaryMonthSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu lương tháng sau cập nhật không đúng định dạng')
  return parsed.data
}

const salaryPaymentSchema = z.object({
  _id: z.string(),
  month: z.string(),
  teacherId: z.coerce.string(),
  amount: z.number().default(0),
  isPaid: z.boolean().default(false),
  paidAt: z.string().nullable().optional(),
})

export type SalaryPayment = z.infer<typeof salaryPaymentSchema>

export async function getSalaryPayments(month: string): Promise<SalaryPayment[]> {
  const response = await apiClient.get(`/v1/salary-payment/${month}`)
  const parsed = z.array(salaryPaymentSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu trạng thái chuyển lương không đúng định dạng')
  return parsed.data
}

export async function updateSalaryPayment(month: string, teacherId: string, amount: number, isPaid: boolean): Promise<SalaryPayment> {
  const response = await apiClient.put(`/v1/salary-payment/${month}/${teacherId}`, { amount, isPaid })
  const parsed = salaryPaymentSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chuyển lương sau cập nhật không đúng định dạng')
  return parsed.data
}
