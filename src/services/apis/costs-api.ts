import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const costSchema = z.object({
  _id: z.string(),
  name: z.string(),
  month: z.string(),
  amount: z.number(),
  details: z.array(z.object({ name: z.string(), price: z.number() })).default([]),
})

export type Cost = z.infer<typeof costSchema>

export async function getCosts(month: string): Promise<Cost[]> {
  const response = await apiClient.get('/v1/cost', { params: { month } })
  const parsed = z.array(costSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chi phí không đúng định dạng')
  return parsed.data
}

export async function createCost(name: string, month: string, amount: number): Promise<Cost> {
  const response = await apiClient.post('/v1/cost', { name, month, amount })
  const parsed = costSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu khoản chi mới không đúng định dạng')
  return parsed.data
}

export async function updateMonthlyCost(id: string, month: string, amount: number): Promise<Cost> {
  const response = await apiClient.put(`/v1/cost/${id}/month/${month}`, { amount })
  const parsed = costSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chi phí sau cập nhật không đúng định dạng')
  return parsed.data
}

export async function addCostDetail(id: string, month: string, name: string, price: number): Promise<Cost> {
  const response = await apiClient.post(`/v1/cost/${id}/month/${month}/details`, { name, price })
  const parsed = costSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chi tiết khoản chi không đúng định dạng')
  return parsed.data
}

export async function updateCostDetail(id: string, month: string, detailIndex: number, name: string, price: number): Promise<Cost> {
  const response = await apiClient.put(`/v1/cost/${id}/month/${month}/details/${detailIndex}`, { name, price })
  const parsed = costSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chi tiết sau cập nhật không đúng định dạng')
  return parsed.data
}

export async function deleteCostDetail(id: string, month: string, detailIndex: number): Promise<Cost> {
  const response = await apiClient.delete(`/v1/cost/${id}/month/${month}/details/${detailIndex}`)
  const parsed = costSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu chi tiết sau khi xóa không đúng định dạng')
  return parsed.data
}
