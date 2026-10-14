import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const paymentReceiptSchema = z.object({
  _id: z.string(),
  children: z.coerce.string(),
  month: z.string(),
  amount: z.number().default(0),
  isPaid: z.boolean().default(false),
  paidAt: z.string().nullable().optional(),
})

export type PaymentReceipt = z.infer<typeof paymentReceiptSchema>

export async function getPaymentReceipts(month: string): Promise<PaymentReceipt[]> {
  const response = await apiClient.get(`/v1/payment-receipt/${month}`)
  const parsed = z.array(paymentReceiptSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu phiếu thu không đúng định dạng')
  return parsed.data
}

export async function updatePaymentReceipt(month: string, childrenId: string, amount: number, isPaid: boolean) {
  const response = await apiClient.put(`/v1/payment-receipt/${month}/${childrenId}`, { amount, isPaid })
  const parsed = paymentReceiptSchema.safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu phiếu thu sau cập nhật không đúng định dạng')
  return parsed.data
}
