import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Search } from 'lucide-react'
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
const formatPaidAt = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
const formatBirthDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('vi-VN')
  : 'Chưa có ngày sinh'

function attendanceAmount(attendance: MonthlyAttendance) {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  if (attendance.type === 'CA_NGAY') {
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
  const [search, setSearch] = useState('')
  const [year, monthNumber] = month.split('-').map(Number)
  const attendancesQuery = useQuery({ queryKey: ['student-receipts-attendance', month], queryFn: () => getMonthlyAttendances(month, 'ALL') })
  const receiptsQuery = useQuery({ queryKey: ['payment-receipts', month], queryFn: () => getPaymentReceipts(month) })
  const rows = useMemo(() => {
    const grouped = new Map<string, {
      childrenId: string
      order: number
      name: string
      birthDate?: string | null
      amount: number
      lessonTypes: Set<string>
      teachers: Set<string>
      lessonCount: number
    }>()
    for (const attendance of attendancesQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      const child = attendance.children
      const current = grouped.get(child._id) || {
        childrenId: child._id,
        order: child.order,
        name: child.name,
        birthDate: child.birthDate,
        amount: 0,
        lessonTypes: new Set<string>(),
        teachers: new Set<string>(),
        lessonCount: 0,
      }
      current.amount += Math.max(attendanceAmount(attendance), 0)
      current.lessonTypes.add(attendance.type === 'CA_NGAY' ? 'Cả ngày' : 'Theo buổi')
      if (child.teacherName) current.teachers.add(child.teacherName)
      for (const day of attendance.days) {
        if (!day.absent) current.lessonCount += 1
        if (day.teacherName) current.teachers.add(day.teacherName)
      }
      grouped.set(child._id, current)
    }
    return [...grouped.values()].sort((left, right) =>
      left.order - right.order || left.name.localeCompare(right.name, 'vi'))
  }, [attendancesQuery.data])
  const paidByChild = useMemo(
    () => new Map((receiptsQuery.data || []).map((receipt) => [receipt.children, receipt])),
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
  const paidCount = rows.filter((row) => paidByChild.get(row.childrenId)?.isPaid).length
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return rows
    return rows.filter((row) => row.name.toLocaleLowerCase('vi').includes(keyword))
  }, [rows, search])

  return <div className="grid min-w-0 gap-4">
    <PageHeader eyebrow="Học Sinh" title="Phiếu thu" description="Theo dõi học phí đã thu theo từng tháng." />
    <Card>
      <CardHeader title={`Phiếu thu Tháng ${monthNumber}/${year}`} description={`${paidCount}/${rows.length} phụ huynh đã đóng`} />
      <div className="flex flex-wrap gap-3 border-b border-border px-4 py-3 sm:px-5">
        <label className="grid gap-1 text-xs font-semibold text-muted">Tháng<select value={monthNumber} onChange={(event) => setMonth(`${year}-${String(event.target.value).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => setMonth(`${event.target.value}-${String(monthNumber).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
        <label className="relative ml-auto self-end"><span className="sr-only">Tìm tên bé</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên bé..." className="h-9 min-w-56 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-main outline-none focus:border-primary" /></label>
      </div>
      {(attendancesQuery.isLoading || receiptsQuery.isLoading) && <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 className="spin" size={18} />Đang tải phiếu thu...</div>}
      {(attendancesQuery.isError || receiptsQuery.isError) && <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải dữ liệu phiếu thu.</div>}
      {attendancesQuery.isSuccess && receiptsQuery.isSuccess && <Table>
        <TableHeader><TableRow><TableHead className="px-3 py-2">Bé & thông tin</TableHead><TableHead className="px-3 py-2">Giáo viên</TableHead><TableHead className="px-3 py-2 text-right">Số tiền thu</TableHead><TableHead className="px-3 py-2">Thời gian thu</TableHead><TableHead className="w-24 px-3 py-2 text-center">Đã thu</TableHead></TableRow></TableHeader>
        <TableBody>{filteredRows.map((row) => {
          const receipt = paidByChild.get(row.childrenId)
          const isPaid = receipt?.isPaid || false
          const isUpdating = updateMutation.isPending && updateMutation.variables?.childrenId === row.childrenId
          return <TableRow key={row.childrenId} className={isPaid ? 'bg-emerald-50/60 dark:bg-emerald-500/10' : ''}>
            <TableCell className="px-3 py-2"><strong className="block">{row.name}</strong><span className="block text-[11px] text-muted">Sinh: {formatBirthDate(row.birthDate)} · {[...row.lessonTypes].join(', ')} · {row.lessonCount} buổi</span></TableCell>
            <TableCell className="px-3 py-2"><span className="text-xs font-medium">{[...row.teachers].join(', ') || 'Chưa có giáo viên'}</span></TableCell>
            <TableCell className="px-3 py-2 text-right font-bold text-red-600">{formatMoney(row.amount)}</TableCell>
            <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted">{isPaid ? formatPaidAt(receipt?.paidAt) : '—'}</TableCell>
            <TableCell className="px-3 py-2 text-center"><label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-emerald-700"><input type="checkbox" checked={isPaid} disabled={isUpdating} onChange={(event) => updateMutation.mutate({ childrenId: row.childrenId, amount: row.amount, isPaid: event.target.checked })} className="h-5 w-5 accent-emerald-600" />{isUpdating ? <Loader2 className="spin" size={15} /> : isPaid && <CheckCircle2 size={15} />}</label></TableCell>
          </TableRow>
        })}</TableBody>
      </Table>}
    </Card>
  </div>
}
