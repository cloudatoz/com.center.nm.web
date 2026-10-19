import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

export const PLAN_CATEGORIES = [
  { key: 'NHAN_THUC_NGON_NGU', title: '1. Nhận thức- ngôn ngữ' },
  { key: 'NHAN_THUC_TU_DUY_MAU_SAC', title: '2. Nhận thức- Tư duy màu sắc' },
  { key: 'TUONG_TAC', title: '3. Tương tác' },
  { key: 'BAT_CHUOC', title: '4. Bắt chước' },
  { key: 'VAN_DONG_TINH', title: '5. Vận động tinh' },
  { key: 'VAN_DONG_THO', title: '6. Vận động thô' },
] as const

const planItemSchema = z.object({
  key: z.string(),
  title: z.string(),
  content: z.string().optional().default(''),
})
const planDaySchema = z.object({ date: z.string(), items: z.array(planItemSchema).default([]) })
const planSchema = z.object({
  _id: z.string(),
  month: z.string(),
  children: z.union([z.object({ _id: z.coerce.string() }), z.coerce.string()])
    .transform((value) => typeof value === 'string' ? value : value._id),
  days: z.array(planDaySchema).default([]),
})

export type PlanItem = z.infer<typeof planItemSchema>
export type PlanDay = z.infer<typeof planDaySchema>
export type Plan = z.infer<typeof planSchema>

const parsePlan = (value: unknown) => {
  const parsed = planSchema.safeParse(value)
  if (!parsed.success) throw new ApiContractError('Dữ liệu kế hoạch không đúng định dạng')
  return parsed.data
}

export async function getPlans(month: string, children: string): Promise<Plan[]> {
  const response = await apiClient.get(`/v1/plan?month=${encodeURIComponent(month)}&children=${encodeURIComponent(children)}`)
  const parsed = z.array(planSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Danh sách kế hoạch không đúng định dạng')
  return parsed.data
}

export async function createPlan(month: string, children: string, days: PlanDay): Promise<Plan>
export async function createPlan(month: string, children: string, days: PlanDay[]): Promise<Plan>
export async function createPlan(month: string, children: string, days: PlanDay | PlanDay[]): Promise<Plan> {
  const response = await apiClient.post('/v1/plan', { month, children: Number(children), days: Array.isArray(days) ? days : [days] })
  return parsePlan(unwrapPayload<unknown>(response.data))
}

export async function updatePlan(id: string, days: PlanDay[]): Promise<Plan> {
  const response = await apiClient.put(`/v1/plan/${encodeURIComponent(id)}`, { days })
  return parsePlan(unwrapPayload<unknown>(response.data))
}
