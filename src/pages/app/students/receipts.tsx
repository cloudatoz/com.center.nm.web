import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMonthlyAttendances, type MonthlyAttendance } from '@/services/apis/attendance-api'
import { getPaymentReceipts, updatePaymentReceipt } from '@/services/apis/payment-receipt-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`

function attendanceAmount(attendance: MonthlyAttendance) {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  if (attendance.type === 'BAN_TRU') {
    return (child?.tuitionFee || 0) + (child?.mealFee || 0) + (child?.csvcFee || 0) +
      (child?.drawingFee || 0) + (child?.languageFee || 0) + (child?.movementFee || 0) -
      attendance.days.reduce((total, day) => total + day.refund, 0)
  }
  return attendance.days.reduce(
    (total, day) => total + day.spendTime * (day.tuitionFee || child?.salaryOneHourForCenter || 0) - day.refund,
    0,
  )
}

export default function StudentReceiptsPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [year, monthNumber] = month.split('-').map(Number)
  const attendancesQuery = useQuery({ queryKey: ['student-receipts-attendance', month], queryFn: () => getMonthlyAttendances(month, 'ALL') })
  const receiptsQuery = useQuery({ queryKey: ['payment-receipts', month], queryFn: () => getPaymentReceipts(month) })
  const rows = useMemo(() => {
    const grouped = new Map<string, { childrenId: string; name: string; amount: number }>()
    for (const attendance of attendancesQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      const child = attendance.children
      const current = grouped.get(child._id) || { childrenId: child._id, name: child.name, amount: 0 }
      current.amount += Math.max(attendanceAmount(attendance), 0)
      grouped.set(child._id, current)
    }
    return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [attendancesQuery.data])
  const paidByChild = useMemo(
    () => new Map((receiptsQuery.data || []).map((receipt) => [receipt.children, receipt.isPaid])),
    [receiptsQuery.data],
  )
  const updateMutation = useMutation({
    mutationFn: ({ childrenId, amount, isPaid }: { childrenId: string; amount: number; isPaid: boolean }) =>
      updatePaymentReceipt(month, childrenId, amount, isPaid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['payment-receipts', month] })
      toast.success('Đã cập nhật trạng thái thu tiền')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật phiếu thu'),
  })
  const paidCount = rows.filter((row) => paidByChild.get(row.childrenId)).length

  return <div className="grid min-w-0 gap-6">
    <PageHeader eyebrow="Học Sinh" title="Phiếu thu" description="Theo dõi học phí đã thu theo từng tháng." />
    <Card>
      <CardHeader title={`Phiếu thu Tháng ${monthNumber}/${year}`} description={`${paidCount}/${rows.length} phụ huynh đã đóng`} />
      <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={monthNumber} onChange={(event) => setMonth(`${year}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text-main">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => setMonth(`${event.target.value}-${String(monthNumber).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm text-text-main">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
      </div>
      {(attendancesQuery.isLoading || receiptsQuery.isLoading) && <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 className="spin" size={18} />Đang tải phiếu thu...</div>}
      {(attendancesQuery.isError || receiptsQuery.isError) && <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải dữ liệu phiếu thu.</div>}
      {attendancesQuery.isSuccess && receiptsQuery.isSuccess && <Table>
        <TableHeader><TableRow><TableHead>Tên bé</TableHead><TableHead className="text-right">Số tiền thu</TableHead><TableHead className="w-36 text-center">Đã thu</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((row) => {
          const isPaid = paidByChild.get(row.childrenId) || false
          const isUpdating = updateMutation.isPending && updateMutation.variables?.childrenId === row.childrenId
          return <TableRow key={row.childrenId} className={isPaid ? 'bg-emerald-50/60 dark:bg-emerald-500/10' : ''}>
            <TableCell className="font-semibold">{row.name}</TableCell>
            <TableCell className="text-right font-bold text-red-600">{formatMoney(row.amount)}</TableCell>
            <TableCell className="text-center"><label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-emerald-700"><input type="checkbox" checked={isPaid} disabled={isUpdating} onChange={(event) => updateMutation.mutate({ childrenId: row.childrenId, amount: row.amount, isPaid: event.target.checked })} className="h-5 w-5 accent-emerald-600" />{isUpdating ? <Loader2 className="spin" size={16} /> : isPaid && <CheckCircle2 size={16} />}</label></TableCell>
          </TableRow>
        })}</TableBody>
      </Table>}
    </Card>
  </div>
}
