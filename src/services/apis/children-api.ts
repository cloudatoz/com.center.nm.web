import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

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
  type: z.union([z.array(z.string()), z.string()]).optional().default([]),
  tuitionFee: z.number().optional().default(0),
  salaryTeacher: z.number().optional().default(0),
  teacherId: z.coerce.string().optional().nullable(),
  teacherName: z.string().optional().default(''),
  mealFee: z.number().optional().default(0),
  csvcFee: z.number().optional().default(0),
  drawingFee: z.number().optional().default(0),
  languageFee: z.number().optional().default(0),
  movementFee: z.number().optional().default(0),
  salaryOneHourForCenter: z.number().optional().default(0),
  invoiceAmount: z.number().optional().default(0),
  isInvoice: z.boolean().optional().default(false),
})

export type Child = z.infer<typeof childSchema>

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

export async function updateChild(id: string, input: UpdateChildInput): Promise<Child> {
  const response = await apiClient.put(`/v1/children/${id}`, input)
  const payload = unwrapPayload<unknown>(response.data)
  const parsed = childSchema.safeParse(payload)
  if (!parsed.success) throw new ApiContractError('Dữ liệu trẻ sau khi cập nhật không đúng định dạng')
  return parsed.data
}
