import { z } from 'zod'
import { ApiContractError, apiClient, unwrapPayload } from './api-client'

const accountBankSchema = z.object({
  _id: z.coerce.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountHolderName: z.string(),
})

export type AccountBank = z.infer<typeof accountBankSchema>

export async function getAccountBanks(): Promise<AccountBank[]> {
  const response = await apiClient.get('/v1/account-bank')
  const parsed = z.array(accountBankSchema).safeParse(unwrapPayload<unknown>(response.data))
  if (!parsed.success) throw new ApiContractError('Dữ liệu tài khoản ngân hàng không đúng định dạng')
  return parsed.data
}

export async function getVietQrImage(params: {
  accountNumber: string
  bankName: string
  amount: number
  description: string
}): Promise<string> {
  const response = await apiClient.get('/v1/vietqr', {
    params: {
      acc: params.accountNumber,
      bank: params.bankName,
      amount: params.amount,
      des: params.description,
    },
    responseType: 'blob',
  })
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Không thể đọc ảnh VietQR'))
    reader.onerror = () => reject(new Error('Không thể đọc ảnh VietQR'))
    reader.readAsDataURL(response.data)
  })
}
