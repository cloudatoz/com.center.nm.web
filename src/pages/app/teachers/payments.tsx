import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, FileImage, Loader2, Search } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMonthlyAttendances } from '@/services/apis/attendance-api'
import { getVietQrImage } from '@/services/apis/account-bank-api'
import { getSalaryMonth, getSalaryPayments, getTeachers, updateSalaryPayment } from '@/services/apis/teachers-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const currentMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
const formatPaidAt = (value?: string | null) => value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

interface PaymentRow {
  teacherId: string
  name: string
  type: string
  amount: number
  totalHours: number
  bankName: string
  accountBank: string
}

export default function TeacherPaymentsPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [receipt, setReceipt] = useState<PaymentRow | null>(null)
  const [copying, setCopying] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [year, monthNumber] = month.split('-').map(Number)
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const attendanceQuery = useQuery({ queryKey: ['teacher-payments-attendance', month], queryFn: () => getMonthlyAttendances(month, 'ALL') })
  const salaryMonthQuery = useQuery({ queryKey: ['salary-month', month], queryFn: () => getSalaryMonth(month) })
  const paymentsQuery = useQuery({ queryKey: ['salary-payments', month], queryFn: () => getSalaryPayments(month) })
  const rows = useMemo(() => {
    const teachers = new Map((teachersQuery.data || []).map((teacher) => [teacher._id, teacher]))
    const fixedIds = new Set((salaryMonthQuery.data?.salaries || []).map((salary) => salary.teacherId))
    const result: PaymentRow[] = (salaryMonthQuery.data?.salaries || []).map((salary) => ({
      teacherId: salary.teacherId,
      name: salary.teacherName,
      type: 'Lương cố định',
      amount: salary.totalSalary,
      totalHours: 0,
      bankName: teachers.get(salary.teacherId)?.nameBank || '',
      accountBank: teachers.get(salary.teacherId)?.accountBank || '',
    }))
    const hourly = new Map<string, { teacherId: string; name: string; amount: number; totalHours: number }>()
    for (const attendance of attendanceQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      for (const day of attendance.days) {
        if (day.absent || !day.teacherId || !day.teacherName || fixedIds.has(day.teacherId)) continue
        const current = hourly.get(day.teacherId) || { teacherId: day.teacherId, name: day.teacherName, amount: 0, totalHours: 0 }
        current.totalHours += day.spendTime
        current.amount += day.spendTime * day.salaryTeacher
        hourly.set(day.teacherId, current)
      }
    }
    for (const salary of hourly.values()) {
      const teacher = teachers.get(salary.teacherId)
      result.push({ ...salary, type: 'Theo giờ', bankName: teacher?.nameBank || '', accountBank: teacher?.accountBank || '' })
    }
    return result.sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [attendanceQuery.data, salaryMonthQuery.data, teachersQuery.data])
  const payments = useMemo(() => new Map((paymentsQuery.data || []).map((payment) => [payment.teacherId, payment])), [paymentsQuery.data])
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return keyword ? rows.filter((row) => row.name.toLocaleLowerCase('vi').includes(keyword)) : rows
  }, [rows, search])
  const updateMutation = useMutation({
    mutationFn: ({ teacherId, amount, isPaid }: { teacherId: string; amount: number; isPaid: boolean }) => updateSalaryPayment(month, teacherId, amount, isPaid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salary-payments', month] })
      toast.success('Đã cập nhật trạng thái phiếu chi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật phiếu chi'),
  })
  const paidCount = rows.filter((row) => payments.get(row.teacherId)?.isPaid).length
  const totalPaid = rows.reduce((sum, row) => sum + (payments.get(row.teacherId)?.isPaid ? row.amount : 0), 0)
  const isLoading = teachersQuery.isLoading || attendanceQuery.isLoading || salaryMonthQuery.isLoading || paymentsQuery.isLoading
  const isError = teachersQuery.isError || attendanceQuery.isError || salaryMonthQuery.isError || paymentsQuery.isError
  const receiptPayment = receipt ? payments.get(receipt.teacherId) : undefined
  const qrQuery = useQuery({
    queryKey: ['teacher-payment-qr', receipt?.accountBank, receipt?.bankName, receipt?.amount, receipt?.name, month],
    queryFn: () => getVietQrImage({ accountNumber: receipt!.accountBank, bankName: receipt!.bankName, amount: receipt!.amount, description: 'CK' }),
    enabled: Boolean(receipt?.accountBank && receipt?.bankName && receipt.amount > 0),
    staleTime: 5 * 60 * 1000,
  })
  const copyReceipt = async () => {
    if (!receiptRef.current) return
    try {
      setCopying(true)
      const blob = await toBlob(receiptRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true })
      if (!blob) throw new Error('Không thể tạo hình phiếu')
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Trình duyệt không hỗ trợ copy hình')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('Đã copy phiếu chi')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể copy hình')
    } finally {
      setCopying(false)
    }
  }

  return <div className="grid min-w-0 gap-4">
    <PageHeader eyebrow="Giáo Viên" title="Phiếu chi" description="Theo dõi tiền lương đã chi cho giáo viên theo từng tháng." />
    <Card>
      <CardHeader title={`Phiếu chi Tháng ${monthNumber}/${year}`} description={`${paidCount}/${rows.length} giáo viên đã nhận · Đã chi ${formatMoney(totalPaid)}`} />
      <div className="flex flex-wrap gap-3 border-b border-border px-4 py-3 sm:px-5">
        <label className="grid gap-1 text-xs font-semibold text-muted">Tháng<select value={monthNumber} onChange={(event) => setMonth(`${year}-${String(event.target.value).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => setMonth(`${event.target.value}-${String(monthNumber).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
        <label className="relative ml-auto self-end"><span className="sr-only">Tìm giáo viên</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên giáo viên..." className="h-9 min-w-56 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text-main outline-none focus:border-primary" /></label>
      </div>
      {isLoading && <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 className="spin" size={18} />Đang tải phiếu chi...</div>}
      {isError && <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải dữ liệu phiếu chi.</div>}
      {!isLoading && !isError && <Table>
        <TableHeader><TableRow><TableHead className="px-3 py-2">Giáo viên</TableHead><TableHead className="px-3 py-2">Tài khoản nhận</TableHead><TableHead className="px-3 py-2 text-right">Số tiền chi</TableHead><TableHead className="px-3 py-2">Thời gian chi</TableHead><TableHead className="w-24 px-3 py-2 text-center">Đã chi</TableHead><TableHead className="px-3 py-2 text-right">Thao tác</TableHead></TableRow></TableHeader>
        <TableBody>{filteredRows.map((row) => {
          const payment = payments.get(row.teacherId)
          const isPaid = payment?.isPaid || false
          const isUpdating = updateMutation.isPending && updateMutation.variables?.teacherId === row.teacherId
          return <TableRow key={row.teacherId} className={isPaid ? 'bg-emerald-50/60 dark:bg-emerald-500/10' : ''}>
            <TableCell className="px-3 py-2"><strong className="block">{row.name}</strong><span className="block text-[11px] text-muted">{row.type}{row.totalHours ? ` · ${row.totalHours} giờ` : ''}</span></TableCell>
            <TableCell className="px-3 py-2"><span className="block text-xs font-semibold">{row.bankName || 'Chưa có ngân hàng'}</span><span className="block text-[11px] text-muted">{row.accountBank || 'Chưa có số tài khoản'}</span></TableCell>
            <TableCell className="px-3 py-2 text-right font-bold text-red-600">{formatMoney(row.amount)}</TableCell>
            <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted">{isPaid ? formatPaidAt(payment?.paidAt) : '—'}</TableCell>
            <TableCell className="px-3 py-2 text-center"><label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-emerald-700"><input type="checkbox" checked={isPaid} disabled={isUpdating} onChange={(event) => updateMutation.mutate({ teacherId: row.teacherId, amount: row.amount, isPaid: event.target.checked })} className="h-5 w-5 accent-emerald-600" />{isUpdating ? <Loader2 className="spin" size={15} /> : isPaid && <CheckCircle2 size={15} />}</label></TableCell>
            <TableCell className="px-3 py-2 text-right"><Button type="button" size="sm" variant="secondary" onClick={() => setReceipt(row)}><FileImage size={14} />Xuất phiếu</Button></TableCell>
          </TableRow>
        })}</TableBody>
      </Table>}
    </Card>
    <Modal open={Boolean(receipt)} onClose={() => !copying && setReceipt(null)} title="Xuất phiếu chi" className="max-h-[92vh] max-w-2xl overflow-auto">
      {receipt && <div className="grid gap-4">
        <div ref={receiptRef} className="mx-auto w-[600px] bg-white p-6 text-slate-900">
          <div className="border-b-2 border-blue-600 pb-3 text-center"><h2 className="m-0 text-xl font-bold">PHIẾU CHI LƯƠNG GIÁO VIÊN</h2><span className="text-xs text-slate-500">Tháng {monthNumber}/{year}</span></div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Giáo viên</span><strong className="block text-xl">{receipt.name}</strong><span className="text-xs text-slate-500">{receipt.type}{receipt.totalHours ? ` · ${receipt.totalHours} giờ` : ''}</span></div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 text-sm"><div className="flex justify-between border-b border-slate-200 p-3"><span>Ngân hàng</span><strong>{receipt.bankName || 'Chưa cập nhật'}</strong></div><div className="flex justify-between border-b border-slate-200 p-3"><span>Số tài khoản</span><strong>{receipt.accountBank || 'Chưa cập nhật'}</strong></div><div className="flex justify-between bg-blue-50 p-4 text-base text-blue-700"><strong>TỔNG CHI</strong><strong>{formatMoney(receipt.amount)}</strong></div></div>
          {receipt.accountBank && receipt.bankName ? <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3"><div><strong className="block text-sm text-blue-800">Quét QR để chuyển lương</strong><span className="text-xs text-slate-600">{receipt.bankName} · {receipt.accountBank}</span></div>{qrQuery.isLoading && <Loader2 size={20} className="spin text-blue-600" />}{qrQuery.data && <img src={qrQuery.data} alt={`QR chuyển lương cho ${receipt.name}`} className="h-28 w-28 object-contain" />}{qrQuery.isError && <span className="text-xs text-red-600">Không tải được QR</span>}</div> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">Chưa có đủ thông tin ngân hàng</div>}
          <div className={`mt-4 rounded-lg p-3 text-center text-sm font-bold ${receiptPayment?.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{receiptPayment?.isPaid ? `ĐÃ CHI · ${formatPaidAt(receiptPayment.paidAt)}` : 'CHƯA CHI'}</div>
          <p className="mb-0 mt-4 text-center text-[9px] text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setReceipt(null)} disabled={copying}>Đóng</Button><Button type="button" onClick={copyReceipt} disabled={copying}>{copying ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}Copy hình</Button></div>
      </div>}
    </Modal>
  </div>
}
