import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

export const childTypeCodeSchema = z.enum([
  'CA_NGAY', 'CA_NHAN', 'TAI_NHA', 'SHADOW',
  'CA_NHAN_DRAW', 'CA_NHAN_LANGUAGE', 'CA_NHAN_MOVEMENT',
])
export const childScheduleSchema = z.object({
  teacherId: z.coerce.string().optional().nullable(),
  teacherName: z.string().optional().default(''),
  teacherPrice: z.number().optional().default(0),
  scheduleInWeek: z.array(z.string()).optional().default([]),
})
export const childTypeConfigSchema = z.object({
  type: childTypeCodeSchema,
  price: z.number().optional().default(0),
  prices: z.object({
    tuition: z.number().optional().default(0),
    csvc: z.number().optional().default(0),
    meal: z.number().optional().default(0),
  }).optional().default({ tuition: 0, csvc: 0, meal: 0 }),
  teacherId: z.coerce.string().optional().nullable(),
  teacherName: z.string().optional().default(''),
  teacherPrice: z.number().optional().default(0),
  scheduleInWeek: z.array(z.string()).optional().default([]),
  schedules: z.array(childScheduleSchema).optional().default([]),
}).transform((config) => {
  const schedules = config.schedules.length ? config.schedules : (config.teacherId || config.scheduleInWeek.length ? [{
    teacherId: config.teacherId,
    teacherName: config.teacherName,
    teacherPrice: config.teacherPrice,
    scheduleInWeek: config.scheduleInWeek,
  }] : [])
  const primary = schedules[0]
  return {
    ...config,
    schedules,
    teacherId: primary?.teacherId || null,
    teacherName: primary?.teacherName || '',
    teacherPrice: primary?.teacherPrice ?? config.teacherPrice,
    scheduleInWeek: [...new Set(schedules.flatMap((schedule) => schedule.scheduleInWeek))],
  }
})
export const childAgeSchema = z.object({
  id: z.string(),
  age: z.number().min(0),
})
const defaultChildAges = [
  'NHAN_THUC_NGON_NGU',
  'NHAN_THUC_TU_DUY_MAU_SAC',
  'TUONG_TAC',
  'BAT_CHUOC',
  'VAN_DONG_TINH',
  'VAN_DONG_THO',
].map((id) => ({ id, age: 3 }))

const childSchema = z.object({
  _id: z.coerce.string(),
  order: z.number().optional().default(0),
  name: z.string(),
  gender: z.string().optional().default(''),
  birthDate: z.string().optional().nullable(),
  avatar: z.string().optional().default(''),
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
  invoiceAmount: z.number().optional().default(0),
  isInvoice: z.boolean().optional().default(false),
  isSend: z.array(z.string()).optional().default([]),
  ages: z.array(childAgeSchema).optional().transform((ages) => ages?.length ? ages : defaultChildAges),
})

export type Child = z.infer<typeof childSchema>
export type ChildTypeCode = z.infer<typeof childTypeCodeSchema>
export type ChildTypeConfig = z.infer<typeof childTypeConfigSchema>
export type ChildSchedule = z.infer<typeof childScheduleSchema>
export type ChildAge = z.infer<typeof childAgeSchema>
export type CreateChildInput = Partial<Omit<Child, '_id'>> & Pick<Child, 'name' | 'gender' | 'avatar' | 'type'>

export async function getChildren(): Promise<Child[]> {
  const response = await apiClient.get('/v1/children')
  const payload = unwrapPayload<unknown>(response.data)
  const parsed = z.array(childSchema).safeParse(payload)

  if (!parsed.success) {
    throw new ApiContractError('Dữ liệu danh sách trẻ không đúng định dạng')
  }

  return parsed.data
}

export type UpdateChildInput = Partial<Omit<Child, '_id'>>

export async function createChild(input: CreateChildInput): Promise<Child> {
  const response = await apiClient.post('/v1/children', input)
  const payload = unwrapPayload<unknown>(response.data)
  const parsed = childSchema.safeParse(payload)
  if (!parsed.success) throw new ApiContractError('Dữ liệu trẻ sau khi tạo không đúng định dạng')
  return parsed.data
}

export async function updateChild(id: string, input: UpdateChildInput): Promise<Child> {
  const response = await apiClient.put(`/v1/children/${id}`, input)
  const payload = unwrapPayload<unknown>(response.data)
  const parsed = childSchema.safeParse(payload)
  if (!parsed.success) throw new ApiContractError('Dữ liệu trẻ sau khi cập nhật không đúng định dạng')
  return parsed.data
}
