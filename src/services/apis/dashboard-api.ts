import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const dashboardMonthSchema = z.object({
  month: z.string(), revenue: z.number(),
  revenueByType: z.object({ CA_NGAY: z.number(), THEO_BUOI: z.number(), TAI_NHA: z.number(), SHADOW: z.number() }),
  operatingCost: z.number(), sessionSalary: z.number(),
  monthlySalary: z.number(), expense: z.number(), profit: z.number(),
  details: z.array(z.object({
    childId: z.string(), childName: z.string(), types: z.array(z.string()),
    descriptions: z.array(z.string()), feeAmounts: z.array(z.number()),
    totalRevenue: z.number(), accounts: z.array(z.string()), accountBankId: z.string().nullable(), isPaid: z.boolean(),
    paymentStatus: z.enum(['NOT_COLLECTED', 'RECEIPT_SENT', 'COLLECTED']),
    teachers: z.array(z.object({
      teacherId: z.number().nullable(), teacherKey: z.string(), name: z.string(), lessons: z.number(),
      rates: z.array(z.number()), salary: z.number(), actualSalary: z.number(), isTransferred: z.boolean(),
    })),
    salary: z.number(), netRevenue: z.number(),
  })).default([]),
})
const childrenByTypeSchema = z.object({
  CA_NGAY: z.number(), CA_NHAN: z.number(), TAI_NHA: z.number(), SHADOW: z.number(),
})
const dashboardSchema = z.object({
  year: z.number(), childrenCount: z.number(), childrenByType: childrenByTypeSchema,
  teachersCount: z.number(), months: z.array(dashboardMonthSchema),
})
export type DashboardOverview = z.infer<typeof dashboardSchema>

export async function getDashboardOverview(year: number): Promise<DashboardOverview> {
  const response = await apiClient.get('/v1/dashboard', { params: { year } })
  const parsed = dashboardSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu bảng số liệu không đúng định dạng')
  return parsed.data
}

export async function updateDashboardDetail(month: string, childrenId: string, body: {
  status?: 'NOT_COLLECTED' | 'RECEIPT_SENT' | 'COLLECTED'
  salaryTransfer?: { teacherKey: string; isTransferred: boolean }
  accountBankId?: string | null
}) {
  await apiClient.patch(`/v1/dashboard/${month}/${childrenId}`, body)
}
