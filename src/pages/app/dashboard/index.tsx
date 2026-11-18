import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Copy, FileImage, Filter, GraduationCap, Loader2, Send, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toCanvas } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { boardingTotal } from '@/lib/child-pricing'
import { getAccountBanks, getVietQrImage } from '@/services/apis/account-bank-api'
import { getMonthlyAttendances, type MonthlyAttendance } from '@/services/apis/attendance-api'
import { getDashboardOverview, updateDashboardDetail } from '@/services/apis/dashboard-api'
import { getSalaryMonth, getTeachers } from '@/services/apis/teachers-api'

const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const CHILD_TYPES = [
  ['CA_NGAY', 'Cả ngày', 'bg-blue-500/10 text-blue-700 dark:text-blue-300'],
  ['CA_NHAN', 'Cá nhân', 'bg-purple-500/10 text-purple-700 dark:text-purple-300'],
  ['TAI_NHA', 'Tại nhà', 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['SHADOW', 'Shadow', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
] as const
const REVENUE_TYPES = [
  ['CA_NGAY', 'Cả ngày', 'bg-blue-500/10 text-blue-700 dark:text-blue-300'],
  ['THEO_BUOI', 'Cá nhân', 'bg-purple-500/10 text-purple-700 dark:text-purple-300'],
  ['TAI_NHA', 'Tại nhà', 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['SHADOW', 'Shadow', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
] as const
const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} đ`
const formatCompactMoney = (value: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const attendanceTypeLabel: Record<string, string> = {
  CA_NGAY: 'Cả ngày', THEO_BUOI: 'Cá nhân', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow',
}
const attendanceTypeColor: Record<string, string> = {
  CA_NGAY: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  THEO_BUOI: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  TAI_NHA: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  SHADOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}
const attendanceTypeOrder: Record<string, number> = { CA_NGAY: 0, THEO_BUOI: 1, TAI_NHA: 2, SHADOW: 3 }
const calendarWeekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const lessonTypeTextColor = (lessonType = 'HỌC') => {
  const normalizedType = lessonType.trim().toLocaleUpperCase('vi')
  if (normalizedType.includes('VẼ')) return 'text-amber-500'
  if (normalizedType.includes('NGOẠI NGỮ')) return 'text-sky-600'
  if (normalizedType.includes('VẬN ĐỘNG')) return 'text-orange-600'
  if (normalizedType === 'HỌC') return 'text-emerald-600'
  return 'text-violet-600'
}
const lessonTypeDisplayText = (lessonType = 'HỌC') => {
  const normalizedType = lessonType.trim().toLocaleUpperCase('vi')
  if (normalizedType.includes('VẼ')) return 'Học (Vẽ)'
  if (normalizedType.includes('VẬN ĐỘNG')) return 'Học (VĐ)'
  if (normalizedType.includes('NGOẠI NGỮ')) return 'Học (NN)'
  if (normalizedType === 'HỌC') return 'Học'
  return 'Học (Khác)'
}
const formatDuration = (hours: number) => {
  const minutes = Math.max(Math.round((Number(hours) || 0) * 60), 0)
  const wholeHours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${wholeHours > 0 ? `${wholeHours}h` : ''}${remainingMinutes > 0 ? `${remainingMinutes}'` : ''}` || "0'"
}
const receiptAmount = (attendance: MonthlyAttendance) => {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  const refunds = attendance.days.reduce((sum, day) => sum + day.refund, 0)
  if (attendance.type === 'CA_NGAY') return boardingTotal(child) - refunds
  if (attendance.type === 'SHADOW') return (attendance.days.find((day) => day.tuitionFee > 0)?.tuitionFee || 0) - refunds
  return attendance.days.reduce((sum, day) => sum + day.spendTime * day.tuitionFee - day.refund, 0)
}
const teacherLineClass = 'flex min-h-9 items-center border-b border-border/70 py-1.5 last:border-b-0'
const paymentStatusMeta = {
  NOT_COLLECTED: { label: 'Chưa thu', title: 'Chưa thu', icon: Clock, className: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' },
  RECEIPT_SENT: { label: 'Đã gửi phiếu', title: 'Đã gửi phiếu PH', icon: Send, className: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300' },
  COLLECTED: { label: 'Đã thu', title: 'Đã thu', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
} as const
const paymentStatusOrder = ['NOT_COLLECTED', 'RECEIPT_SENT', 'COLLECTED'] as const
const abbreviateName = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return name
  return `${words.slice(0, -1).map((word) => `${word[0].toLocaleUpperCase('vi')}.`).join(' ')} ${words.at(-1)}`
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [teacherFilter, setTeacherFilter] = useState('ALL')
  const [detailSort, setDetailSort] = useState<'NAME' | 'TYPE'>('NAME')
  const [selectedTeacherKey, setSelectedTeacherKey] = useState<string | null>(null)
  const [receiptChildId, setReceiptChildId] = useState<string | null>(null)
  const [receiptBankId, setReceiptBankId] = useState('')
  const [copyingReceipt, setCopyingReceipt] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const overviewQuery = useQuery({ queryKey: ['dashboard-overview', year], queryFn: () => getDashboardOverview(year) })
  const accountBanksQuery = useQuery({ queryKey: ['account-banks'], queryFn: getAccountBanks })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`
  const receiptCalendarDays = [
    ...Array.from({ length: (new Date(year, month - 1, 1).getDay() + 6) % 7 }, () => null),
    ...Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => index + 1),
  ]
  const salaryMonthQuery = useQuery({ queryKey: ['salary-month', selectedMonthKey], queryFn: () => getSalaryMonth(selectedMonthKey) })
  const receiptAttendancesQuery = useQuery({
    queryKey: ['dashboard-receipt-attendances', selectedMonthKey],
    queryFn: () => getMonthlyAttendances(selectedMonthKey, 'ALL'),
    enabled: Boolean(receiptChildId),
  })
  const selected = overviewQuery.data?.months[month - 1]
  const receiptRows = (receiptAttendancesQuery.data || []).filter((attendance) =>
    (typeof attendance.children === 'string' ? attendance.children : attendance.children._id) === receiptChildId,
  )
  const receiptChild = receiptRows.length && typeof receiptRows[0].children !== 'string' ? receiptRows[0].children : null
  const receiptTotal = receiptRows.reduce((sum, attendance) => sum + Math.max(receiptAmount(attendance), 0), 0)
  const receiptBank = accountBanksQuery.data?.find((bank) => bank._id === receiptBankId)
  const receiptQrQuery = useQuery({
    queryKey: ['dashboard-receipt-qr', receiptBank?.accountNumber, receiptBank?.bankName, receiptTotal, receiptChild?.name],
    queryFn: () => getVietQrImage({ accountNumber: receiptBank!.accountNumber, bankName: receiptBank!.bankName, amount: receiptTotal, description: receiptChild!.name }),
    enabled: Boolean(receiptChildId && receiptBank && receiptChild?.name && receiptTotal > 0),
  })
  const teacherOptions = Array.from(new Map((selected?.details || []).flatMap((row) => row.teachers).map((teacher) => [teacher.teacherKey, { key: teacher.teacherKey, name: teacher.name }])).values()).sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  const filteredDetails = (selected?.details || [])
    .filter((row) => typeFilter === 'ALL' || row.types.includes(typeFilter))
    .filter((row) => teacherFilter === 'ALL' || row.teachers.some((teacher) => teacher.teacherKey === teacherFilter))
    .map((row) => teacherFilter === 'ALL' ? row : { ...row, teachers: row.teachers.filter((teacher) => teacher.teacherKey === teacherFilter) })
    .sort((left, right) => detailSort === 'TYPE'
      ? Math.min(...left.types.map((type) => attendanceTypeOrder[type] ?? 999)) - Math.min(...right.types.map((type) => attendanceTypeOrder[type] ?? 999)) || left.childName.localeCompare(right.childName, 'vi')
      : left.childName.localeCompare(right.childName, 'vi'))
  const selectedTeacherSummary = (() => {
    if (!selectedTeacherKey || !selected) return null
    const lessons = selected.details.flatMap((row) => row.teachers
      .filter((teacher) => teacher.teacherKey === selectedTeacherKey)
      .map((teacher) => ({ childId: row.childId, childName: row.childName, types: row.types, ...teacher })))
    const first = lessons[0]
    if (!first) return null
    const normalizedName = first.name.trim().toLocaleLowerCase('vi')
    const fixedSalary = salaryMonthQuery.data?.salaries.find((salary) =>
      (first.teacherId != null && String(salary.teacherId) === String(first.teacherId)) || salary.teacherName.trim().toLocaleLowerCase('vi') === normalizedName,
    )
    const teacher = teachersQuery.data?.find((item) =>
      (first.teacherId != null && String(item._id) === String(first.teacherId)) || item.name.trim().toLocaleLowerCase('vi') === normalizedName,
    )
    const sessionSalary = lessons.reduce((sum, item) => sum + item.actualSalary, 0)
    return {
      name: first.name,
      teacher,
      lessons,
      fixedSalary,
      totalLessons: lessons.reduce((sum, item) => sum + item.lessons, 0),
      sessionSalary,
      totalSalary: sessionSalary + (fixedSalary?.totalSalary || 0),
    }
  })()
  const teacherSalaryQrQuery = useQuery({
    queryKey: ['dashboard-teacher-salary-qr', selectedTeacherSummary?.teacher?.accountBank, selectedTeacherSummary?.teacher?.nameBank, selectedTeacherSummary?.totalSalary, selectedMonthKey],
    queryFn: () => getVietQrImage({
      accountNumber: selectedTeacherSummary!.teacher!.accountBank,
      bankName: selectedTeacherSummary!.teacher!.nameBank,
      amount: selectedTeacherSummary!.totalSalary,
      description: 'CK',
    }),
    enabled: Boolean(selectedTeacherSummary?.teacher?.accountBank && selectedTeacherSummary?.teacher?.nameBank && selectedTeacherSummary.totalSalary > 0),
    staleTime: 5 * 60 * 1000,
  })
  const updateDetailMutation = useMutation({
    mutationFn: ({ childrenId, body }: { childrenId: string; body: Parameters<typeof updateDashboardDetail>[2] }) => updateDashboardDetail(`${year}-${String(month).padStart(2, '0')}`, childrenId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-overview', year] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu'),
  })
  const markAllTeacherSalarySentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacherSummary) return
      const pendingLessons = selectedTeacherSummary.lessons.filter((lesson) => !lesson.isTransferred)
      await Promise.all(pendingLessons.map((lesson) => updateDashboardDetail(selectedMonthKey, lesson.childId, {
        salaryTransfer: { teacherKey: lesson.teacherKey, isTransferred: true },
      })))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview', year] })
      toast.success('Đã đánh dấu tất cả khoản lương là đã gửi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái gửi lương'),
  })
  const generateMonthlySummaryMutation = useMutation({
    mutationFn: () => getMonthlyAttendances(selectedMonthKey, 'ALL'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview', year] })
      toast.success(`Đã tạo bảng tổng hợp Tháng ${month}/${year}`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể tạo bảng tổng hợp tháng'),
  })
  const copyReceiptImage = async () => {
    if (!receiptRef.current) return
    try {
      setCopyingReceipt(true)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const sourceCanvas = await toCanvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        style: { margin: '0' },
      })
      const safePadding = 16
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = sourceCanvas.width + safePadding * 2
      outputCanvas.height = sourceCanvas.height + safePadding * 2
      const context = outputCanvas.getContext('2d')
      if (!context) throw new Error('Không thể tạo vùng ảnh')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, outputCanvas.width, outputCanvas.height)
      context.drawImage(sourceCanvas, safePadding, safePadding)
      const blob = await new Promise<Blob | null>((resolve) => outputCanvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Không thể tạo hình phiếu')
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Trình duyệt không hỗ trợ copy hình')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('Đã copy hình phiếu, bạn có thể dán để gửi phụ huynh')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể copy hình phiếu')
    } finally {
      setCopyingReceipt(false)
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Tổng quan" title="Bảng Số Liệu" description="Theo dõi thu, chi, nhân sự và kết quả hoạt động theo từng tháng." />
      <Card className="flex flex-wrap items-end gap-3 p-4 sm:px-6">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
      </Card>
      {overviewQuery.isLoading && <Card className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tổng hợp số liệu...</Card>}
      {overviewQuery.isError && <Card className="p-5 text-sm text-red-700">{overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Không thể tải bảng số liệu'}</Card>}
      {overviewQuery.data && selected && <>
        <div className="order-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600"><TrendingUp size={16} /></span><span className="text-xs font-semibold text-muted">Tổng thu Tháng {month}</span></div><strong className="mt-3 block text-lg text-emerald-600">{formatMoney(selected.revenue)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600"><TrendingDown size={16} /></span><span className="text-xs font-semibold text-muted">Tổng chi Tháng {month}</span></div><strong className="mt-3 block text-lg text-red-600">{formatMoney(selected.expense)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected.profit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{selected.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</span><span className="text-xs font-semibold text-muted">Chênh lệch Thu - Chi</span></div><strong className={`mt-3 block text-lg ${selected.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(selected.profit)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600"><GraduationCap size={16} /></span><span className="text-xs font-semibold text-muted">Tổng số học sinh</span></div><strong className="mt-3 block text-lg text-text-main">{overviewQuery.data.childrenCount}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-600"><Users size={16} /></span><span className="text-xs font-semibold text-muted">Tổng số giáo viên</span></div><strong className="mt-3 block text-lg text-text-main">{overviewQuery.data.teachersCount}</strong></Card>
        </div>
        <div className="order-3 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader title={`Chi tiết tổng thu Tháng ${month}`} description="Doanh thu được phân theo từng loại học." />
            <Table>
              <TableHeader><TableRow><TableHead>Loại học</TableHead><TableHead className="text-right">Doanh thu</TableHead><TableHead className="text-right">Tỷ trọng</TableHead></TableRow></TableHeader>
              <TableBody>
                {REVENUE_TYPES.map(([type, label, color]) => {
                  const revenue = selected.revenueByType[type]
                  const percentage = selected.revenue > 0 ? revenue / selected.revenue * 100 : 0
                  return <TableRow key={type}><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span></TableCell><TableCell className="text-right font-bold">{formatMoney(revenue)}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={`Chi tiết chi Tháng ${month}`} description="Các nhóm chi phí đã tổng hợp." />
            <Table>
              <TableHeader><TableRow><TableHead>Khoản chi</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead className="text-right">Tỷ trọng</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ['Chi phí vận hành', selected.operatingCost],
                  ['Lương GV theo buổi', selected.sessionSalary],
                  ['Lương GV cố định', selected.monthlySalary],
                ].map(([label, amount]) => {
                  const value = Number(amount)
                  const percentage = selected.expense > 0 ? value / selected.expense * 100 : 0
                  return <TableRow key={String(label)}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right font-bold text-red-600 dark:text-red-400">{formatMoney(value)}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Chi tiết học sinh" description="Một học sinh có thể thuộc nhiều loại học." />
            <Table>
              <TableHeader><TableRow><TableHead>Loại học</TableHead><TableHead className="text-right">Số học sinh</TableHead><TableHead className="text-right">Tỷ lệ</TableHead></TableRow></TableHeader>
              <TableBody>
                {CHILD_TYPES.map(([type, label, color]) => {
                  const count = overviewQuery.data.childrenByType[type]
                  const percentage = overviewQuery.data.childrenCount > 0 ? count / overviewQuery.data.childrenCount * 100 : 0
                  return <TableRow key={type}><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span></TableCell><TableCell className="text-right font-bold">{count}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
        <Card className="order-1 overflow-hidden">
          <CardHeader title={`Bảng tổng hợp Tháng ${month}/${year}`} description="Tổng hợp khoản thu, tài khoản nhận tiền và lương giáo viên theo từng trẻ." action={<div className="flex flex-wrap gap-2"><label className="grid gap-1 text-xs font-semibold text-muted">Giáo viên<select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="h-9 max-w-52 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="ALL">Tất cả giáo viên</option>{teacherOptions.map((teacher) => <option key={teacher.key} value={teacher.key}>{teacher.name}</option>)}</select></label><label className="grid gap-1 text-xs font-semibold text-muted">Loại học<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="ALL">Tất cả loại</option><option value="CA_NGAY">Cả ngày</option><option value="THEO_BUOI">Cá nhân</option><option value="TAI_NHA">Tại nhà</option><option value="SHADOW">Shadow</option></select></label><label className="grid gap-1 text-xs font-semibold text-muted">Sắp xếp<select value={detailSort} onChange={(event) => setDetailSort(event.target.value as 'NAME' | 'TYPE')} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="NAME">Theo tên trẻ</option><option value="TYPE">Theo loại học</option></select></label></div>} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-orange-200 bg-orange-50 px-5 py-2 text-xs text-text-main dark:border-orange-500/20 dark:bg-orange-500/10"><div className="flex flex-wrap items-center gap-1.5"><strong>PH:</strong><span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">C</span><span>= Chưa thu</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">G</span><span>= Đã gửi phiếu PH</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">GR</span><span>= Đã thu</span></div><div className="flex flex-wrap items-center gap-1.5"><strong>GV:</strong><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">C</span><span>= Chưa gửi</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">G</span><span>= Đã chuyển lương</span></div></div>
          <Table containerClassName="max-h-[100vh] overflow-auto" className="min-w-[1040px] text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-white/30 [&_th:last-child]:border-r-0">
            <TableHeader className="sticky top-0 z-30 border-orange-300 bg-orange-500 text-white shadow-md dark:bg-orange-600 dark:text-white">
              <TableRow className="hover:bg-orange-500 dark:hover:bg-orange-600">
                <TableHead className="w-14 text-center text-white">STT</TableHead>
                <TableHead className="w-32 max-w-32 text-white">Tên trẻ</TableHead>
                <TableHead className="w-24 max-w-24 text-right text-white">Phí thu</TableHead>
                <TableHead className="text-right text-white">Tổng thu</TableHead>
                <TableHead className="text-white">Tài khoản</TableHead>
                <TableHead className="text-center text-white">Xác nhận PH</TableHead>
                <TableHead className="min-w-[470px] text-white"><div className="grid grid-cols-[minmax(90px,1fr)_80px_72px_minmax(100px,1fr)_110px] items-stretch gap-3"><span>Giáo viên</span><span className="border-l border-white/30 pl-3 text-right">Số tiết</span><span className="border-l border-white/30 pl-3 text-right">Lương</span><span className="border-l border-white/30 pl-3 text-right">Thực lãnh</span><span className="border-l border-white/30 pl-3 text-center">Xác nhận</span></div></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDetails.map((row, index) => <TableRow key={row.childId}>
                <TableCell className="text-center text-muted">{index + 1}</TableCell>
                <TableCell className="w-32 max-w-32"><Link to={`/students/history?month=${year}-${String(month).padStart(2, '0')}&childId=${row.childId}`} className="block truncate whitespace-nowrap font-bold text-primary underline-offset-2 transition hover:underline" title={`Mở điểm danh của ${row.childName}`}>{abbreviateName(row.childName)}</Link><div className="mt-1 flex flex-wrap gap-1">{row.types.map((type) => <span key={type} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attendanceTypeColor[type] || 'bg-surface-muted text-muted'}`}>{attendanceTypeLabel[type] || type}</span>)}</div></TableCell>
                <TableCell className="w-24 max-w-24 text-right text-xs font-medium"><div className="grid gap-0.5 whitespace-nowrap">{row.feeAmounts.length ? row.feeAmounts.map((amount) => <span key={amount}>{formatMoney(amount)}</span>) : '—'}</div></TableCell>
                <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(row.totalRevenue)}</TableCell>
                <TableCell><div className="grid justify-items-start gap-1.5"><select value={row.accountBankId || ''} disabled={updateDetailMutation.isPending || accountBanksQuery.isLoading} onChange={(event) => updateDetailMutation.mutate({ childrenId: row.childId, body: { accountBankId: event.target.value || null } })} aria-label={`Tài khoản nhận tiền của ${row.childName}`} className="h-9 max-w-28 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary"><option value="">Tiền mặt</option>{accountBanksQuery.data?.map((account) => <option key={account._id} value={account._id}>{account.description || account.bankName}</option>)}</select><button type="button" disabled={updateDetailMutation.isPending} onClick={() => { setReceiptBankId(row.accountBankId || ''); setReceiptChildId(row.childId) }} className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11px] font-bold text-emerald-600 underline-offset-2 transition hover:text-emerald-700 hover:underline disabled:cursor-wait disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300" title={`Xuất phiếu thu của ${row.childName}`}><FileImage size={13} />Xuất phiếu</button></div></TableCell>
                <TableCell className="text-center">{(() => { const meta = paymentStatusMeta[row.paymentStatus]; const Icon = meta.icon; const currentIndex = paymentStatusOrder.indexOf(row.paymentStatus); const nextStatus = paymentStatusOrder[(currentIndex + 1) % paymentStatusOrder.length]; return <button type="button" title={`${meta.title} · Bấm để chuyển trạng thái`} aria-label={`${meta.title} của ${row.childName}`} disabled={updateDetailMutation.isPending} onClick={() => updateDetailMutation.mutate({ childrenId: row.childId, body: { status: nextStatus } })} className={`inline-flex h-9 min-w-28 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-extrabold shadow-xs transition disabled:cursor-wait disabled:opacity-60 ${meta.className}`}><Icon size={14} />{meta.label}</button> })()}</TableCell>
                <TableCell className="py-1"><div>{row.teachers.length ? row.teachers.map((teacher) => <div key={`${teacher.teacherId}-${teacher.name}`} className="grid min-h-10 grid-cols-[minmax(90px,1fr)_80px_72px_minmax(100px,1fr)_110px] items-stretch gap-3 border-b border-border/70 py-1.5 last:border-b-0"><div className="flex min-w-0 items-center gap-1"><button type="button" onClick={() => setSelectedTeacherKey(teacher.teacherKey)} className="min-w-0 flex-1 truncate whitespace-nowrap text-left font-bold text-primary underline-offset-2 transition hover:underline" title={`Xem chi tiết lương tháng của ${teacher.name}`}>{abbreviateName(teacher.name)}</button><button type="button" onClick={() => setTeacherFilter((current) => current === teacher.teacherKey ? 'ALL' : teacher.teacherKey)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition ${teacherFilter === teacher.teacherKey ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted hover:bg-primary/10 hover:text-primary'}`} title={teacherFilter === teacher.teacherKey ? 'Bỏ lọc và xem tất cả giáo viên' : `Lọc theo ${teacher.name}`} aria-label={teacherFilter === teacher.teacherKey ? 'Bỏ lọc giáo viên' : `Lọc bảng theo giáo viên ${teacher.name}`}><Filter size={14} /></button></div><span className="flex items-center justify-end whitespace-nowrap border-l border-border/70 pl-3 text-muted">{teacher.lessons.toLocaleString('vi-VN')} tiết</span><span className="grid content-center gap-0.5 whitespace-nowrap border-l border-border/70 pl-3 text-right text-xs">{teacher.rates.length ? teacher.rates.map((rate) => <span key={rate}>{formatMoney(rate)}</span>) : '—'}</span><strong className="flex items-center justify-end whitespace-nowrap border-l border-border/70 pl-3 text-blue-600 dark:text-blue-400">{formatMoney(teacher.actualSalary)}</strong><div className="flex items-center justify-center border-l border-border/70 pl-3"><button type="button" title={`${teacher.isTransferred ? 'Đã chuyển lương' : 'Chưa gửi'} · Bấm để đổi trạng thái`} aria-label={`Xác nhận chuyển lương của ${teacher.name}`} disabled={updateDetailMutation.isPending} onClick={() => updateDetailMutation.mutate({ childrenId: row.childId, body: { salaryTransfer: { teacherKey: teacher.teacherKey, isTransferred: !teacher.isTransferred } } })} className={`inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-extrabold shadow-xs transition disabled:cursor-wait disabled:opacity-60 ${teacher.isTransferred ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}`}>{teacher.isTransferred ? <CheckCircle2 size={13} /> : <Clock size={13} />}{teacher.isTransferred ? 'Đã gửi' : 'Chưa gửi'}</button></div></div>) : '—'}</div></TableCell>
              </TableRow>)}
              {!filteredDetails.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted">{selected.details.length === 0 ? <div className="grid justify-items-center gap-3"><div><strong className="block text-text-main">Tháng này chưa có bảng tổng hợp</strong><span className="mt-1 block text-xs">Tạo dữ liệu theo danh sách học sinh đang học và lịch học đã cấu hình.</span></div><Button type="button" disabled={generateMonthlySummaryMutation.isPending} onClick={() => generateMonthlySummaryMutation.mutate()}>{generateMonthlySummaryMutation.isPending ? <Loader2 size={16} className="spin" /> : <GraduationCap size={16} />}{generateMonthlySummaryMutation.isPending ? 'Đang tạo...' : 'Tạo bảng tổng hợp'}</Button></div> : teacherFilter !== 'ALL' ? 'Không có dữ liệu của giáo viên đã chọn.' : typeFilter === 'ALL' ? 'Chưa có dữ liệu trong tháng này.' : 'Không có trẻ thuộc loại học đã chọn.'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>

        <Modal open={Boolean(receiptChildId)} onClose={() => !copyingReceipt && setReceiptChildId(null)} title="Xuất phiếu" description={`Phiếu thu Tháng ${month}/${year}`} className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          {receiptAttendancesQuery.isLoading && <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tải dữ liệu phiếu...</div>}
          {receiptAttendancesQuery.isError && <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">Không thể tải dữ liệu phiếu thu.</div>}
          {receiptAttendancesQuery.isSuccess && receiptChild && <div className="grid gap-4">
            <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/70 p-2 sm:p-3 dark:border-emerald-500/60 dark:bg-emerald-500/10"><div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold text-emerald-700 dark:text-emerald-300"><FileImage size={14} />Khu vực được copy</div><div ref={receiptRef} className={`mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm ${copyingReceipt ? 'w-[700px] max-w-none p-4' : 'w-full max-w-[700px] p-3 sm:p-4'}`}>
              <div className="text-center"><h3 className="m-0 text-xl font-extrabold uppercase text-blue-800">Phiếu thu học phí</h3><span className="mt-1 block text-sm text-slate-500">Tháng {month}/{year}</span></div>
              <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2.5 sm:grid-cols-[1fr_auto]"><div><strong className="block text-lg">{receiptChild.name}</strong>{receiptChild.birthDate && <span className="text-xs text-slate-600">Ngày sinh: {new Date(receiptChild.birthDate).toLocaleDateString('vi-VN')}</span>}</div><div className="sm:text-right"><span className="text-[11px] font-semibold text-slate-500">Tổng học phí</span><strong className="block text-xl text-emerald-600">{formatMoney(receiptTotal)}</strong></div></div>
              <h3 className="mb-1 mt-2 text-xs font-bold uppercase text-slate-700">Lịch học Tháng {month}/{year}</h3>
              <div className="grid gap-2">{receiptRows.filter((attendance) => attendance.days.length > 0).map((attendance) => {
                const presentDays = attendance.days.filter((day) => !day.absent)
                const hours = presentDays.reduce((sum, day) => sum + (attendance.type === 'CA_NGAY' || attendance.type === 'SHADOW' ? 0 : day.spendTime), 0)
                const isFullDay = attendance.type === 'CA_NGAY' || attendance.type === 'SHADOW'
                return <section key={attendance._id} className="overflow-hidden rounded-lg border border-slate-300"><div className="flex items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-2.5 py-1.5"><strong className="text-xs uppercase text-slate-800">{attendanceTypeLabel[attendance.type] || attendance.type}</strong><span className="text-[11px] text-slate-600">{presentDays.length} ngày{hours > 0 ? ` · ${hours}h` : ''} · <strong className="text-emerald-700">{formatMoney(Math.max(receiptAmount(attendance), 0))}</strong></span></div><div className="grid grid-cols-7 border-l border-t border-slate-300">{calendarWeekdays.map((weekday, weekdayIndex) => <div key={weekday} className={`border-b border-r border-slate-300 px-1 py-1.5 text-center text-[11px] font-bold ${weekdayIndex >= 5 ? 'bg-slate-200' : 'bg-amber-100'}`}>{weekday}</div>)}{receiptCalendarDays.map((day, dayIndex) => {
                  if (!day) return <div key={`empty-${attendance._id}-${dayIndex}`} className="min-h-14 border-b border-r border-slate-300 bg-slate-50" />
                  const items = attendance.days.filter((item) => Number(item.date.slice(8, 10)) === day && (isFullDay || item.absent || item.spendTime > 0))
                  return <div key={`${attendance._id}-${day}`} className={`min-h-14 border-b border-r border-slate-300 p-1 ${items.some((item) => !item.absent) ? 'bg-emerald-50' : items.some((item) => item.absent) ? 'bg-amber-50' : 'bg-white'}`}><strong className="block text-xs">{day}</strong>{items.map((item, itemIndex) => <div key={`${item.date}-${item.teacherId || itemIndex}`} className={`mt-0.5 text-[10px] leading-tight ${item.absent ? 'text-red-600' : lessonTypeTextColor(isFullDay ? 'HỌC' : item.lessonType)}`}><strong>{item.absent ? 'Nghỉ' : isFullDay ? 'Học' : `${lessonTypeDisplayText(item.lessonType)} · ${formatDuration(item.spendTime)}`}</strong>{item.notes && <span className="block text-violet-600">* {item.notes}</span>}{item.refund > 0 && <span className="block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</div>)}</div>
                })}</div></section>
              })}</div>
              <div className="mt-2 grid items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-900 sm:grid-cols-[1fr_auto]"><div>{receiptBank ? <><strong className="block text-sm">Thông tin thanh toán</strong><span className="mt-0.5 block">Ngân hàng: <strong>{receiptBank.bankName}</strong></span><span className="block">Số tài khoản: <strong>{receiptBank.accountNumber}</strong></span><span className="block">Chủ tài khoản: <strong>{receiptBank.accountHolderName}</strong></span><span className="block">Nội dung: <strong>{receiptChild.name}</strong></span></> : <><strong className="block text-sm">Thanh toán tiền mặt</strong><span className="mt-0.5 block">Số tiền: <strong className="text-red-600">{formatMoney(receiptTotal)}</strong></span></>}</div>{receiptBank && (receiptQrQuery.data ? <img src={receiptQrQuery.data} alt={`QR thanh toán của ${receiptChild.name}`} className="mx-auto h-32 w-32 rounded-lg bg-white object-contain sm:mx-0" /> : <div className="grid h-32 w-32 place-items-center rounded-lg bg-white text-center text-xs text-slate-500">{receiptQrQuery.isError ? 'Không tải được QR' : 'Đang tải QR...'}</div>)}</div>
            </div></div>
            <label className="ml-auto flex w-fit items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100"><span>Tài khoản</span><select value={receiptBankId} onChange={(event) => setReceiptBankId(event.target.value)} className="h-9 max-w-44 rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600"><option value="">Tiền mặt</option>{accountBanksQuery.data?.map((account) => <option key={account._id} value={account._id}>{account.description || account.bankName}</option>)}</select></label>
            <div className="sticky bottom-0 z-10 flex justify-end border-t border-border bg-surface/95 py-3 backdrop-blur"><Button type="button" disabled={copyingReceipt || (!receiptBank ? false : !receiptQrQuery.isSuccess)} onClick={copyReceiptImage}>{copyingReceipt ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}{copyingReceipt ? 'Đang tạo hình...' : receiptBank && !receiptQrQuery.isSuccess ? 'Đang tải QR...' : 'Copy hình phiếu'}</Button></div>
          </div>}
          {receiptAttendancesQuery.isSuccess && !receiptChild && <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">Không có dữ liệu học của học sinh trong tháng này.</div>}
        </Modal>

        <Modal open={Boolean(selectedTeacherKey)} onClose={() => setSelectedTeacherKey(null)} title={selectedTeacherSummary?.name || 'Chi tiết lương giáo viên'} description={`Toàn bộ thông tin lương Tháng ${month}/${year}`} className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedTeacherSummary ? <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/30 dark:bg-purple-500/10"><span className="text-xs font-semibold text-muted">Lương theo tiết/buổi</span><strong className="mt-2 block text-lg text-purple-700 dark:text-purple-300">{formatMoney(selectedTeacherSummary.sessionSalary)}</strong><span className="mt-1 block text-xs text-muted">{selectedTeacherSummary.totalLessons.toLocaleString('vi-VN')} tiết</span></div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10"><span className="text-xs font-semibold text-muted">Lương cố định</span><strong className="mt-2 block text-lg text-blue-700 dark:text-blue-300">{formatMoney(selectedTeacherSummary.fixedSalary?.totalSalary || 0)}</strong><span className="mt-1 block text-xs text-muted">Sau điều chỉnh nghỉ phép</span></div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"><span className="text-xs font-semibold text-muted">Tổng lương tháng</span><strong className="mt-2 block text-lg text-emerald-700 dark:text-emerald-300">{formatMoney(selectedTeacherSummary.totalSalary)}</strong><span className="mt-1 block text-xs text-muted">Lương theo tiết + cố định</span></div>
            </div>

            {selectedTeacherSummary.teacher?.accountBank && selectedTeacherSummary.teacher.nameBank ? <section className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><h4 className="m-0 text-sm font-bold text-blue-900 dark:text-blue-200">Quét QR để chuyển lương</h4><span className="mt-2 block text-xs text-muted">{selectedTeacherSummary.teacher.nameBank}</span><div className="mt-1 flex flex-wrap items-center gap-2"><strong className="font-mono text-base text-blue-800 dark:text-blue-300">{selectedTeacherSummary.teacher.accountBank}</strong><Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(selectedTeacherSummary.teacher!.accountBank).then(() => toast.success('Đã sao chép số tài khoản')).catch(() => toast.error('Không thể sao chép số tài khoản'))}><Copy size={13} />Sao chép STK</Button></div><strong className="mt-2 block text-lg text-blue-700 dark:text-blue-300">{formatMoney(selectedTeacherSummary.totalSalary)}</strong></div>
              <div className="grid h-36 w-36 shrink-0 place-items-center self-center rounded-xl bg-white p-2 shadow-sm">{teacherSalaryQrQuery.isLoading && <Loader2 size={22} className="spin text-blue-600" />}{teacherSalaryQrQuery.data && <img src={teacherSalaryQrQuery.data} alt={`QR chuyển lương cho ${selectedTeacherSummary.name}`} className="h-full w-full object-contain" />}{teacherSalaryQrQuery.isError && <span className="text-center text-xs text-red-600">Không tải được mã QR</span>}</div>
            </section> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">Giáo viên chưa có đủ ngân hàng và số tài khoản để tạo mã QR.</section>}

            <section className="overflow-hidden rounded-2xl border border-border">
              <div className="border-b border-border bg-surface-muted/60 px-4 py-3"><h4 className="m-0 text-sm font-bold">Chi tiết lương theo trẻ</h4></div>
              <Table>
                <TableHeader><TableRow><TableHead>Trẻ</TableHead><TableHead>Loại học</TableHead><TableHead className="text-right">Số tiết</TableHead><TableHead className="text-right">Đơn giá</TableHead><TableHead className="text-right">Thực lãnh</TableHead><TableHead className="text-center">Trạng thái</TableHead></TableRow></TableHeader>
                <TableBody>{selectedTeacherSummary.lessons.map((item) => <TableRow key={`${item.childId}-${item.teacherKey}`}><TableCell className="font-semibold">{item.childName}</TableCell><TableCell><div className="flex flex-wrap gap-1">{item.types.map((type) => <span key={type} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attendanceTypeColor[type] || 'bg-surface-muted text-muted'}`}>{attendanceTypeLabel[type] || type}</span>)}</div></TableCell><TableCell className="text-right">{item.lessons.toLocaleString('vi-VN')}</TableCell><TableCell className="text-right"><div className="grid gap-0.5">{item.rates.length ? item.rates.map((rate) => <span key={rate}>{formatMoney(rate)}</span>) : '—'}</div></TableCell><TableCell className="text-right font-bold text-primary">{formatMoney(item.actualSalary)}</TableCell><TableCell className="text-center"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${item.isTransferred ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>{item.isTransferred ? 'Đã chuyển' : 'Chưa gửi'}</span></TableCell></TableRow>)}</TableBody>
              </Table>
            </section>

            <section className="grid gap-3 rounded-2xl border border-border p-4">
              <div><h4 className="m-0 text-sm font-bold">Chi tiết lương cố định</h4><p className="mb-0 mt-1 text-xs text-muted">Các khoản lương và ngày nghỉ trong tháng</p></div>
              {selectedTeacherSummary.fixedSalary ? <><dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl bg-surface-muted/60 p-3"><dt className="text-[11px] font-semibold uppercase text-muted">Lương cơ bản</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selectedTeacherSummary.fixedSalary.baseSalary)}</dd></div><div className="rounded-xl bg-surface-muted/60 p-3"><dt className="text-[11px] font-semibold uppercase text-muted">Hỗ trợ bảo hiểm</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selectedTeacherSummary.fixedSalary.insuranceSupport)}</dd></div><div className="rounded-xl bg-surface-muted/60 p-3"><dt className="text-[11px] font-semibold uppercase text-muted">Chuyên cần</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selectedTeacherSummary.fixedSalary.attendanceBonus)}</dd></div><div className="rounded-xl bg-surface-muted/60 p-3"><dt className="text-[11px] font-semibold uppercase text-muted">Lương khác</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selectedTeacherSummary.fixedSalary.otherSalary)}</dd></div></dl>{selectedTeacherSummary.fixedSalary.absents.length > 0 && <div><strong className="text-xs">Ngày nghỉ:</strong><div className="mt-2 flex flex-wrap gap-2">{selectedTeacherSummary.fixedSalary.absents.map((absent) => <span key={`${absent.date}-${absent.isPaidLeave}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${absent.isPaidLeave ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>{new Date(absent.date).toLocaleDateString('vi-VN')} · {absent.isPaidLeave ? 'Có phép' : 'Không phép'}{absent.subSalary > 0 ? ` · Trừ ${formatMoney(absent.subSalary)}` : ''}</span>)}</div></div>}</> : <p className="m-0 rounded-xl bg-surface-muted/60 p-4 text-sm text-muted">Giáo viên này không có lương cố định trong tháng.</p>}
            </section>

            <div className="flex justify-end border-t border-border pt-4"><Button type="button" disabled={markAllTeacherSalarySentMutation.isPending || selectedTeacherSummary.lessons.every((lesson) => lesson.isTransferred)} onClick={() => markAllTeacherSalarySentMutation.mutate()}>{markAllTeacherSalarySentMutation.isPending ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}{selectedTeacherSummary.lessons.every((lesson) => lesson.isTransferred) ? 'Tất cả đã gửi' : 'Đã gửi tất cả'}</Button></div>
          </div> : <div className="flex min-h-40 items-center justify-center text-sm text-muted">Không tìm thấy dữ liệu lương của giáo viên.</div>}
        </Modal>

        <Card className="order-4 min-w-0 overflow-hidden">
            <CardHeader title={`Biểu đồ Thu - Chi năm ${year}`} description="So sánh tổng thu, tổng chi và chênh lệch theo từng tháng." />
            <div className="h-80 min-w-0 p-4 pt-1 sm:p-6 sm:pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={overviewQuery.data.months.map((item, index) => ({ ...item, label: `T${index + 1}` }))} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.35} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(value) => formatCompactMoney(Number(value))} tickLine={false} axisLine={false} width={58} fontSize={11} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(label) => `${label}/${year}`} contentStyle={{ borderRadius: 12, borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Tổng thu" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Tổng chi" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="profit" name="Chênh lệch" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
        </Card>
      </>}
    </div>
  )
}
