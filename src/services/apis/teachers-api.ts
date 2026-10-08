import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const teacherSchema = z.object({
  _id: z.string(),
  account: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  description: z.string().optional().default(''),
  otherSalary: z.number().optional().default(0),
  accountBank: z.string().optional().default(''),
  nameBank: z.string().optional().default(''),
  createdAt: z.string().optional(),
})

export type Teacher = z.infer<typeof teacherSchema>
export type UpdateTeacherInput = Partial<Omit<Teacher, '_id'>>

export async function getTeachers(): Promise<Teacher[]> {
  const response = await apiClient.get('/v1/teacher')
  const parsed = z.array(teacherSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu danh sách giáo viên không đúng định dạng')
  return parsed.data
}

export async function updateTeacher(id: string, input: UpdateTeacherInput): Promise<Teacher> {
  const response = await apiClient.put(`/v1/teacher/${id}`, input)
  const parsed = teacherSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu giáo viên sau khi cập nhật không đúng định dạng')
  return parsed.data
}
