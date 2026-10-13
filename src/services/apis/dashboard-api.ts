import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const dashboardMonthSchema = z.object({
  month: z.string(), revenue: z.number(), operatingCost: z.number(), sessionSalary: z.number(),
  monthlySalary: z.number(), expense: z.number(), profit: z.number(),
})
const dashboardSchema = z.object({ year: z.number(), childrenCount: z.number(), teachersCount: z.number(), months: z.array(dashboardMonthSchema) })
export type DashboardOverview = z.infer<typeof dashboardSchema>

export async function getDashboardOverview(year: number): Promise<DashboardOverview> {
  const response = await apiClient.get('/v1/dashboard', { params: { year } })
  const parsed = dashboardSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu bảng số liệu không đúng định dạng')
  return parsed.data
}
