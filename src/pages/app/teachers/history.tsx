import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Copy, FileImage, Loader2, Pencil, Search, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMonthlyAttendances, type MonthlyAttendance } from '@/services/apis/attendance-api'
import { getVietQrImage } from '@/services/apis/account-bank-api'
import { getSalaryMonth, getSalaryPayments, getTeachers, type SalaryMonth, type Teacher, updateMonthlySalary, updateSalaryPayment, updateTeacher } from '@/services/apis/teachers-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const CALENDAR_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const currentMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
const formatDateInput = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
const attendanceBonusAmount = (salary: SalaryMonth['salaries'][number]) => salary.absents.length >= 2 ? 0 : salary.attendanceBonus
type AttendanceChild = Exclude<MonthlyAttendance['children'], string>
type AttendanceDay = MonthlyAttendance['days'][number]

interface ChildTeachingGroup {
  child: AttendanceChild
  days: AttendanceDay[]
  salaryPerHour: number
  totalHours: number
  totalSalary: number
}

interface TeacherTeachingGroup {
  teacherId: string
  teacherName: string
  children: ChildTeachingGroup[]
  totalHours: number
  totalSalary: number
}

export default function TeacherHistoryPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [receipt, setReceipt] = useState<TeacherTeachingGroup | null>(null)
  const [editingHourlyTeacher, setEditingHourlyTeacher] = useState<Teacher | null>(null)
  const [fixedReceipt, setFixedReceipt] = useState<SalaryMonth['salaries'][number] | null>(null)
  const [editingFixedSalary, setEditingFixedSalary] = useState<SalaryMonth['salaries'][number] | null>(null)
  const [absentDates, setAbsentDates] = useState<string[]>([])
  const [paidLeaveDates, setPaidLeaveDates] = useState<string[]>([])
  const [absenceMode, setAbsenceMode] = useState<'UNPAID' | 'PAID'>('UNPAID')
  const [copying, setCopying] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [selectedYear, selectedMonth] = month.split('-').map(Number)
  const fixedSalaryCalendarDays = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate()
    const firstDayOffset = (new Date(selectedYear, selectedMonth - 1, 1).getDay() + 6) % 7
    return [...Array.from({ length: firstDayOffset }, () => null), ...Array.from({ length: totalDays }, (_, index) => index + 1)]
  }, [selectedMonth, selectedYear])
  const attendanceQuery = useQuery({ queryKey: ['teacher-history', month], queryFn: () => getMonthlyAttendances(month, 'ALL') })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const salaryMonthQuery = useQuery({ queryKey: ['salary-month', month], queryFn: () => getSalaryMonth(month) })
  const receiptTeacher = teachersQuery.data?.find((teacher) => teacher._id === receipt?.teacherId)
  const fixedReceiptTeacher = teachersQuery.data?.find((teacher) => teacher._id === fixedReceipt?.teacherId)
  const activeReceiptTeacher = fixedReceipt ? fixedReceiptTeacher : receiptTeacher
  const activeReceiptAmount = fixedReceipt?.totalSalary ?? receipt?.totalSalary ?? 0
  const salaryPaymentsQuery = useQuery({ queryKey: ['salary-payments', month], queryFn: () => getSalaryPayments(month) })
  const activePayment = salaryPaymentsQuery.data?.find((payment) => payment.teacherId === activeReceiptTeacher?._id)
  const salaryQrQuery = useQuery({
    queryKey: ['salary-vietqr', activeReceiptTeacher?.accountBank, activeReceiptTeacher?.nameBank, activeReceiptAmount, activeReceiptTeacher?.name, month],
    queryFn: () => getVietQrImage({ accountNumber: activeReceiptTeacher!.accountBank, bankName: activeReceiptTeacher!.nameBank, amount: activeReceiptAmount, description: 'CK' }),
    enabled: Boolean(activeReceiptTeacher?.accountBank && activeReceiptTeacher?.nameBank && activeReceiptAmount > 0 && (fixedReceipt || receipt)),
    staleTime: 5 * 60 * 1000,
  })
  const salaryPaymentMutation = useMutation({
    mutationFn: ({ teacherId, amount, isPaid }: { teacherId: string; amount: number; isPaid: boolean }) => updateSalaryPayment(month, teacherId, amount, isPaid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salary-payments', month] })
      toast.success('Đã cập nhật trạng thái chuyển lương')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái chuyển lương'),
  })
  const updateFixedSalaryMutation = useMutation({
    mutationFn: ({ teacherId, data }: { teacherId: string; data: Parameters<typeof updateMonthlySalary>[2] }) =>
      updateMonthlySalary(month, teacherId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['salary-month', month] })
      setEditingFixedSalary(null)
      toast.success('Đã cập nhật lương cố định')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật lương cố định'),
  })
  const updateHourlyTeacherMutation = useMutation({
    mutationFn: ({ id, isPayInsurance }: { id: string; isPayInsurance: boolean }) => updateTeacher(id, { isPayInsurance }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setEditingHourlyTeacher(null)
      toast.success('Đã cập nhật giáo viên')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật giáo viên'),
  })
  const fixedSalaryTeacherIds = useMemo(() => new Set((salaryMonthQuery.data?.salaries || []).map((salary) => salary.teacherId)), [salaryMonthQuery.data])

  const teacherGroups = useMemo(() => {
    const teachers = new Map<string, { teacherName: string; children: Map<string, ChildTeachingGroup> }>()
    for (const attendance of attendanceQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      const child = attendance.children
      for (const day of attendance.days) {
        if (day.absent || !day.teacherId || !day.teacherName || fixedSalaryTeacherIds.has(day.teacherId)) continue
        const teacher = teachers.get(day.teacherId) || { teacherName: day.teacherName, children: new Map<string, ChildTeachingGroup>() }
        const childGroup = teacher.children.get(child._id) || { child, days: [], salaryPerHour: day.salaryTeacher || child.salaryTeacher || 0, totalHours: 0, totalSalary: 0 }
        childGroup.days.push(day)
        childGroup.salaryPerHour = day.salaryTeacher || child.salaryTeacher || childGroup.salaryPerHour
        childGroup.totalHours += day.spendTime
        childGroup.totalSalary += day.spendTime * (day.salaryTeacher || child.salaryTeacher || 0)
        teacher.children.set(child._id, childGroup)
        teachers.set(day.teacherId, teacher)
      }
    }
    return [...teachers.entries()].map(([teacherId, teacher]) => {
      const children = [...teacher.children.values()].sort((left, right) => left.child.name.localeCompare(right.child.name, 'vi'))
      return {
        teacherId,
        teacherName: teacher.teacherName,
        children,
        totalHours: children.reduce((sum, child) => sum + child.totalHours, 0),
        totalSalary: children.reduce((sum, child) => sum + child.totalSalary, 0),
      }
    }).sort((left, right) => left.teacherName.localeCompare(right.teacherName, 'vi'))
  }, [attendanceQuery.data, fixedSalaryTeacherIds])
  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return keyword ? teacherGroups.filter((group) => group.teacherName.toLocaleLowerCase('vi').includes(keyword) || group.children.some((child) => child.child.name.toLocaleLowerCase('vi').includes(keyword))) : teacherGroups
  }, [search, teacherGroups])
  const fixedSalaryGroups = useMemo(() => {
    const teachingByTeacher = new Map<string, Map<string, ChildTeachingGroup>>()
    for (const attendance of attendanceQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      for (const day of attendance.days) {
        if (day.absent || !day.teacherId || !fixedSalaryTeacherIds.has(day.teacherId)) continue
        const children = teachingByTeacher.get(day.teacherId) || new Map<string, ChildTeachingGroup>()
        const salaryPerHour = day.salaryTeacher || attendance.children.salaryTeacher || 0
        const childGroup = children.get(attendance.children._id) || { child: attendance.children, days: [], salaryPerHour, totalHours: 0, totalSalary: 0 }
        childGroup.days.push(day)
        childGroup.salaryPerHour = salaryPerHour || childGroup.salaryPerHour
        childGroup.totalHours += day.spendTime
        childGroup.totalSalary += day.spendTime * salaryPerHour
        children.set(attendance.children._id, childGroup)
        teachingByTeacher.set(day.teacherId, children)
      }
    }
    const keyword = search.trim().toLocaleLowerCase('vi')
    return (salaryMonthQuery.data?.salaries || []).map((salary) => {
      const children = [...(teachingByTeacher.get(salary.teacherId)?.values() || [])].sort((left, right) => left.child.name.localeCompare(right.child.name, 'vi'))
      return { ...salary, children, totalHours: children.reduce((sum, child) => sum + child.totalHours, 0) }
    }).filter((group) => !keyword || group.teacherName.toLocaleLowerCase('vi').includes(keyword) || group.children.some((child) => child.child.name.toLocaleLowerCase('vi').includes(keyword)))
  }, [attendanceQuery.data, fixedSalaryTeacherIds, salaryMonthQuery.data, search])
  const totalSalary = filteredGroups.reduce((sum, group) => sum + group.totalSalary, 0)
  const formatTeachingDates = (days: AttendanceDay[]) => {
    const dates = [...new Set(days.map((day) => Number(day.date.slice(8, 10))))].sort((left, right) => left - right)
    return `${dates.join(', ')}/${selectedMonth}`
  }

  const openFixedSalaryEditor = (salary: SalaryMonth['salaries'][number]) => {
    setEditingFixedSalary(salary)
    setAbsentDates(salary.absents.filter((absent) => !absent.isPaidLeave).map((absent) => formatDateInput(absent.date)))
    setPaidLeaveDates(salary.absents.filter((absent) => absent.isPaidLeave).map((absent) => formatDateInput(absent.date)))
    setAbsenceMode('UNPAID')
  }

  const submitFixedSalary = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingFixedSalary) return
    const form = new FormData(event.currentTarget)
    updateFixedSalaryMutation.mutate({
      teacherId: editingFixedSalary.teacherId,
      data: {
        baseSalary: Number(form.get('baseSalary')) || 0,
        insuranceSupport: Number(form.get('insuranceSupport')) || 0,
        attendanceBonus: Number(form.get('attendanceBonus')) || 0,
        otherSalary: Number(form.get('otherSalary')) || 0,
        absents: [
          ...absentDates.map((date) => ({ date, isPaidLeave: false })),
          ...paidLeaveDates.map((date) => ({ date, isPaidLeave: true })),
        ],
      },
    })
  }

  const copyReceipt = async () => {
    if (!receiptRef.current) return
    try {
      setCopying(true)
      const blob = await toBlob(receiptRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true })
      if (!blob) throw new Error('Không thể tạo hình phiếu')
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Trình duyệt không hỗ trợ copy hình')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast.success('Đã copy phiếu lương giáo viên')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể copy hình')
    } finally {
      setCopying(false)
    }
  }

  const salaryQrBlock = activeReceiptTeacher?.accountBank && activeReceiptTeacher.nameBank ? <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
    <div className="min-w-0 text-xs"><strong className="block text-sm text-blue-800">Quét QR để chuyển lương</strong><span className="mt-1 block text-slate-600">{activeReceiptTeacher.nameBank} · {activeReceiptTeacher.accountBank}</span><span className="block font-bold text-blue-700">{formatMoney(activeReceiptAmount)}</span></div>
    {salaryQrQuery.isLoading && <div className="grid h-28 w-28 shrink-0 place-items-center"><Loader2 size={20} className="spin text-blue-600" /></div>}
    {salaryQrQuery.data && <img src={salaryQrQuery.data} alt={`QR chuyển lương cho ${activeReceiptTeacher.name}`} className="h-28 w-28 shrink-0 object-contain" />}
    {salaryQrQuery.isError && <span className="w-28 shrink-0 text-center text-[10px] text-red-600">Không tải được QR</span>}
  </div> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-semibold text-amber-700">Chưa có đủ ngân hàng và số tài khoản của giáo viên</div>

  const paidStatus = activePayment?.isPaid ? <span className="mr-auto inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><CheckCircle2 size={17} />Đã chuyển{activePayment.paidAt ? ` · ${new Date(activePayment.paidAt).toLocaleString('vi-VN')}` : ''}</span> : null
  const markPaidButton = <Button type="button" variant={activePayment?.isPaid ? 'secondary' : 'primary'} disabled={!activeReceiptTeacher || activePayment?.isPaid || salaryPaymentMutation.isPending} onClick={() => activeReceiptTeacher && salaryPaymentMutation.mutate({ teacherId: activeReceiptTeacher._id, amount: activeReceiptAmount, isPaid: true })}>{salaryPaymentMutation.isPending ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}{activePayment?.isPaid ? 'Đã chuyển' : 'Xác nhận đã chuyển'}</Button>
  const transferredCheckbox = (teacherId: string, amount: number) => {
    const payment = salaryPaymentsQuery.data?.find((item) => item.teacherId === teacherId)
    return <label className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${payment?.isPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-surface text-muted'}`}><input type="checkbox" checked={payment?.isPaid === true} disabled={salaryPaymentMutation.isPending} onChange={(event) => salaryPaymentMutation.mutate({ teacherId, amount, isPaid: event.target.checked })} className="h-4 w-4 accent-emerald-600" />Đã chuyển</label>
  }

  return <div className="grid gap-6">
    <PageHeader eyebrow="Giáo Viên" title="Lịch sử dạy (Trả lương)" description="Tổng hợp các trẻ đã dạy, số giờ và tiền lương theo từng giáo viên." />
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4 sm:px-6">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
        <label className="relative min-w-60 flex-1"><span className="sr-only">Tìm kiếm</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm giáo viên hoặc trẻ..." className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
        <div className="ml-auto rounded-xl bg-primary/10 px-4 py-2"><span className="block text-[10px] font-semibold uppercase text-muted">Tổng lương theo buổi</span><strong className="text-lg text-primary">{formatMoney(totalSalary)}</strong></div>
      </div>
    </Card>
    {salaryMonthQuery.isLoading && <Card className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tải lương cố định tháng...</Card>}
    {salaryMonthQuery.isSuccess && fixedSalaryGroups.length > 0 && <div className="flex items-center gap-3"><span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Các cô cả ngày</span><span className="h-px flex-1 bg-blue-300 dark:bg-blue-500/40" /></div>}
    {salaryMonthQuery.isSuccess && fixedSalaryGroups.map((salary) => <Card key={salary.teacherId} className="overflow-hidden shadow-md shadow-slate-200/60 dark:shadow-none">
      <CardHeader title={salary.teacherName} description={`Lương cố định · ${salary.children.length} trẻ · ${salary.totalHours} giờ`} action={<div className="flex items-center gap-2"><strong className="mr-1 text-primary">{formatMoney(salary.totalSalary)}</strong><Button type="button" size="sm" variant="secondary" onClick={() => openFixedSalaryEditor(salary)}><Pencil size={14} />Chỉnh sửa</Button>{transferredCheckbox(salary.teacherId, salary.totalSalary)}<Button type="button" size="sm" onClick={() => setFixedReceipt(salary)}><FileImage size={14} />Xuất phiếu</Button></div>} />
      <Table><TableHeader><TableRow><TableHead>Lương cơ bản</TableHead><TableHead>Bảo hiểm</TableHead><TableHead>Chuyên cần</TableHead><TableHead>Lương khác</TableHead><TableHead>Ngày nghỉ</TableHead><TableHead className="text-right">Tổng thực nhận</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="whitespace-nowrap font-medium">{formatMoney(salary.baseSalary)}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.insuranceSupport)}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(attendanceBonusAmount(salary))}{salary.absents.length >= 2 && <span className="block text-[10px] text-red-600">Mất do nghỉ từ 2 ngày</span>}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.otherSalary)}</TableCell><TableCell>{salary.absents.length ? <div className="grid min-w-52 gap-1">{salary.absents.map((absent) => <span key={absent.date} className={`rounded-md px-2 py-1 text-[10px] font-semibold ${absent.isPaidLeave ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>{new Date(absent.date).toLocaleDateString('vi-VN')} · {absent.isPaidLeave ? 'Phép' : `-${formatMoney(absent.subSalary)}`}</span>)}</div> : '—'}</TableCell><TableCell className="whitespace-nowrap text-right text-base font-bold text-primary">{formatMoney(salary.totalSalary)}</TableCell></TableRow></TableBody></Table>
      {salary.children.length > 0 && <div className="border-t border-border"><div className="bg-surface-muted/40 px-4 py-2 text-[11px] font-bold uppercase text-muted">Trẻ và ngày dạy</div><Table><TableHeader><TableRow><TableHead>Tên trẻ</TableHead><TableHead>Ngày dạy</TableHead><TableHead>Số giờ</TableHead><TableHead>Lương 1 giờ</TableHead><TableHead className="text-right">Tiền lương</TableHead></TableRow></TableHeader><TableBody>{salary.children.map((child) => <TableRow key={child.child._id}><TableCell className="font-semibold">{child.child.name}</TableCell><TableCell className="font-medium">{formatTeachingDates(child.days)}</TableCell><TableCell>{child.totalHours} giờ</TableCell><TableCell className="whitespace-nowrap">{formatMoney(child.salaryPerHour)}</TableCell><TableCell className="text-right font-bold text-primary">{formatMoney(child.totalSalary)}</TableCell></TableRow>)}</TableBody></Table></div>}
    </Card>)}
    {attendanceQuery.isLoading && <Card className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tổng hợp lịch sử dạy...</Card>}
    {attendanceQuery.isError && <Card className="p-5 text-sm text-red-700">Không thể tải lịch sử dạy.</Card>}
    {attendanceQuery.isSuccess && filteredGroups.length === 0 && <Card className="grid min-h-56 place-items-center text-center text-muted"><div><Users size={34} className="mx-auto" /><p>Chưa có dữ liệu dạy trong tháng này.</p></div></Card>}
    {attendanceQuery.isSuccess && filteredGroups.length > 0 && <div className="flex items-center gap-3"><span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">Các cô cá nhân</span><span className="h-px flex-1 bg-purple-300 dark:bg-purple-500/40" /></div>}
    {filteredGroups.map((group) => <Card key={group.teacherId} className="overflow-hidden shadow-md shadow-slate-200/60 dark:shadow-none">
      <CardHeader title={group.teacherName} description={`${group.children.length} trẻ · ${group.totalHours} giờ`} action={<div className="flex items-center gap-2"><strong className="mr-1 text-primary">{formatMoney(group.totalSalary)}</strong><Button type="button" size="sm" variant="secondary" onClick={() => { const teacher = teachersQuery.data?.find((item) => item._id === group.teacherId); if (teacher) setEditingHourlyTeacher(teacher); else toast.error('Không tìm thấy thông tin giáo viên') }}><Pencil size={14} />Chỉnh sửa</Button>{transferredCheckbox(group.teacherId, group.totalSalary)}<Button type="button" size="sm" variant="secondary" onClick={() => setReceipt(group)}><FileImage size={14} />Xuất phiếu</Button></div>} />
      <Table><TableHeader><TableRow><TableHead>Tên trẻ</TableHead><TableHead>Ngày dạy</TableHead><TableHead>Số giờ</TableHead><TableHead>Lương 1 giờ</TableHead><TableHead className="text-right">Tiền lương</TableHead></TableRow></TableHeader><TableBody>{group.children.map((child) => <TableRow key={child.child._id}><TableCell className="font-semibold">{child.child.name}</TableCell><TableCell className="font-medium">{formatTeachingDates(child.days)}</TableCell><TableCell>{child.totalHours} giờ</TableCell><TableCell className="whitespace-nowrap">{formatMoney(child.salaryPerHour)}</TableCell><TableCell className="text-right font-bold text-primary">{formatMoney(child.totalSalary)}</TableCell></TableRow>)}</TableBody></Table>
    </Card>)}
    <Modal open={Boolean(editingHourlyTeacher)} onClose={() => !updateHourlyTeacherMutation.isPending && setEditingHourlyTeacher(null)} title="Chỉnh sửa giáo viên cá nhân" description={editingHourlyTeacher?.name}>
      {editingHourlyTeacher && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); updateHourlyTeacherMutation.mutate({ id: editingHourlyTeacher._id, isPayInsurance: form.get('isPayInsurance') === 'on' }) }} className="grid gap-5">
        <label className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm font-semibold"><input name="isPayInsurance" type="checkbox" defaultChecked={editingHourlyTeacher.isPayInsurance} className="h-5 w-5 accent-primary" />Có đóng bảo hiểm</label>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" disabled={updateHourlyTeacherMutation.isPending} onClick={() => setEditingHourlyTeacher(null)}>Hủy</Button><Button type="submit" disabled={updateHourlyTeacherMutation.isPending}>{updateHourlyTeacherMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div>
      </form>}
    </Modal>

    <Modal open={Boolean(editingFixedSalary)} onClose={() => !updateFixedSalaryMutation.isPending && setEditingFixedSalary(null)} title="Chỉnh sửa lương cố định" description={editingFixedSalary?.teacherName} className="max-h-[92vh] max-w-2xl overflow-y-auto">
      {editingFixedSalary && <form onSubmit={submitFixedSalary} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Lương cơ bản<input name="baseSalary" type="number" min="0" step="1000" defaultValue={editingFixedSalary.baseSalary} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Hỗ trợ bảo hiểm<input name="insuranceSupport" type="number" min="0" step="1000" defaultValue={editingFixedSalary.insuranceSupport} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Chuyên cần<input name="attendanceBonus" type="number" min="0" step="1000" defaultValue={editingFixedSalary.attendanceBonus} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Lương khác<input name="otherSalary" type="number" min="0" step="1000" defaultValue={editingFixedSalary.otherSalary} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal" /></label>
        </div>
        <div className="grid gap-3 rounded-xl border border-border p-4">
          <div><strong className="text-sm">Ngày nghỉ</strong><span className="ml-2 text-xs text-muted">Trừ lương: {absentDates.length} · Nghỉ phép: {paidLeaveDates.length}</span></div>
          <div className="flex gap-2"><Button type="button" size="sm" variant={absenceMode === 'UNPAID' ? 'danger' : 'secondary'} onClick={() => setAbsenceMode('UNPAID')}>Nghỉ trừ lương</Button><Button type="button" size="sm" variant={absenceMode === 'PAID' ? 'primary' : 'secondary'} onClick={() => setAbsenceMode('PAID')}>Nghỉ phép</Button></div>
          <div className="grid grid-cols-7 gap-1.5">{CALENDAR_WEEKDAYS.map((weekday, index) => <div key={weekday} className={`py-1 text-center text-[10px] font-bold uppercase ${index === 6 ? 'text-slate-400' : 'text-muted'}`}>{weekday}</div>)}{fixedSalaryCalendarDays.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />
            const date = `${month}-${String(day).padStart(2, '0')}`
            const isSunday = new Date(selectedYear, selectedMonth - 1, day).getDay() === 0
            const isAbsent = absentDates.includes(date)
            const isPaidLeave = paidLeaveDates.includes(date)
            return <button key={date} type="button" disabled={isSunday} onClick={() => {
              if (absenceMode === 'UNPAID') {
                setPaidLeaveDates((dates) => dates.filter((item) => item !== date))
                setAbsentDates((dates) => isAbsent ? dates.filter((item) => item !== date) : [...dates, date].sort())
              } else {
                setAbsentDates((dates) => dates.filter((item) => item !== date))
                setPaidLeaveDates((dates) => isPaidLeave ? dates.filter((item) => item !== date) : [...dates, date].sort())
              }
            }} className={`relative min-h-14 rounded-lg border p-1 text-left transition ${isAbsent ? 'border-red-400 bg-red-50 text-red-700 ring-1 ring-red-300' : isPaidLeave ? 'border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-300' : isSunday ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-border bg-surface hover:border-primary/40 hover:bg-primary/5'}`}><strong className="block text-sm">{day}</strong>{isAbsent && <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold">TRỪ LƯƠNG</span>}{isPaidLeave && <span className="absolute bottom-1 left-1 right-1 text-center text-[9px] font-bold">NGHỈ PHÉP</span>}</button>
          })}</div>
          <span className="text-[11px] text-muted">Chủ nhật không tính là ngày làm việc nên không thể chọn nghỉ.</span>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" disabled={updateFixedSalaryMutation.isPending} onClick={() => setEditingFixedSalary(null)}>Hủy</Button><Button type="submit" disabled={updateFixedSalaryMutation.isPending}>{updateFixedSalaryMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div>
      </form>}
    </Modal>

    <Modal open={Boolean(fixedReceipt)} onClose={() => !copying && setFixedReceipt(null)} title="Xuất phiếu lương cố định" className="max-h-[92vh] max-w-3xl overflow-auto">
      {fixedReceipt && <div className="grid gap-4"><div ref={receiptRef} className="mx-auto w-[650px] bg-white p-6 text-slate-900">
        <div className="border-b-2 border-blue-600 pb-3 text-center"><h2 className="m-0 text-xl font-bold">PHIẾU LƯƠNG CỐ ĐỊNH</h2><span className="text-xs text-slate-500">Tháng {selectedMonth}/{selectedYear}</span></div>
        <div className="mt-4 rounded-xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Giáo viên</span><strong className="block text-xl">{fixedReceipt.teacherName}</strong>{fixedReceipt.isPayInsurance && <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Có đóng bảo hiểm</span>}</div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 text-sm"><div className="flex justify-between border-b border-slate-200 p-3"><span>Lương cơ bản</span><strong>{formatMoney(fixedReceipt.baseSalary)}</strong></div><div className="flex justify-between border-b border-slate-200 p-3"><span>Hỗ trợ bảo hiểm</span><strong>{formatMoney(fixedReceipt.insuranceSupport)}</strong></div><div className="flex justify-between border-b border-slate-200 p-3"><span>{fixedReceipt.absents.length >= 2 ? `Chuyên cần (mất do nghỉ từ 2 ngày)` : `Chuyên cần`}</span><strong className={fixedReceipt.absents.length >= 2 ? `text-red-600` : undefined}>{formatMoney(attendanceBonusAmount(fixedReceipt))}</strong></div><div className="flex justify-between border-b border-slate-200 p-3"><span>Lương khác</span><strong>{formatMoney(fixedReceipt.otherSalary)}</strong></div>{fixedReceipt.absents.map((absent) => <div key={absent.date} className={`flex justify-between border-b p-3 ${absent.isPaidLeave ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-red-100 bg-red-50 text-red-700'}`}><span>{absent.isPaidLeave ? 'Nghỉ phép' : 'Trừ nghỉ'} ngày {new Date(absent.date).toLocaleDateString('vi-VN')}</span><strong>{absent.isPaidLeave ? 'Không trừ lương' : `- ${formatMoney(absent.subSalary)}`}</strong></div>)}<div className="flex justify-between bg-blue-50 p-4 text-base text-blue-700"><strong>TỔNG THỰC NHẬN</strong><strong>{formatMoney(fixedReceipt.totalSalary)}</strong></div></div>
        {salaryQrBlock}
        <p className="mb-0 mt-4 text-center text-[9px] text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p>
      </div><div className="flex items-center justify-end gap-2 border-t border-border pt-4">{paidStatus}<Button type="button" variant="secondary" onClick={() => setFixedReceipt(null)} disabled={copying}>Đóng</Button><Button type="button" onClick={copyReceipt} disabled={copying}>{copying ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}Copy hình</Button>{markPaidButton}</div></div>}
    </Modal>

    <Modal open={Boolean(receipt)} onClose={() => !copying && setReceipt(null)} title="Xuất phiếu lương" className="max-h-[92vh] max-w-4xl overflow-auto">
      {receipt && <div className="grid gap-4"><div ref={receiptRef} className="mx-auto w-[760px] bg-white p-6 text-slate-900"><div className="border-b-2 border-primary pb-3 text-center"><h2 className="m-0 text-xl font-bold">PHIẾU TỔNG HỢP LỊCH SỬ DẠY</h2></div><div className="mt-4 flex items-end justify-between rounded-xl bg-slate-50 p-4"><div><span className="text-xs text-slate-500">Giáo viên</span><strong className="block text-xl">{receipt.teacherName}</strong>{receiptTeacher?.isPayInsurance && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Có đóng bảo hiểm</span>}<span className="text-xs text-slate-500">Tháng {selectedMonth}/{selectedYear}</span></div><div className="text-right"><strong className="block text-xl text-blue-600">{formatMoney(receipt.totalSalary)}</strong><span className="text-xs text-slate-500">{receipt.totalHours} giờ</span></div></div><h3 className="mb-2 mt-4 text-xs font-bold uppercase text-slate-600">Các trẻ đã dạy</h3><div className="overflow-hidden rounded-lg border border-slate-300"><table className="w-full border-collapse text-xs"><thead className="bg-slate-100"><tr><th className="border-b border-r border-slate-300 p-2 text-left">Tên trẻ</th><th className="w-44 border-b border-r border-slate-300 px-2 py-2 text-left">Ngày dạy</th><th className="border-b border-r border-slate-300 p-2">Giờ</th><th className="border-b border-r border-slate-300 p-2">Lương 1 giờ</th><th className="border-b border-slate-300 p-2 text-right">Tiền lương</th></tr></thead><tbody>{receipt.children.map((child) => <tr key={child.child._id}><td className="border-b border-r border-slate-200 p-2 font-semibold">{child.child.name}</td><td className="w-44 border-b border-r border-slate-200 px-2 py-2 text-[11px] font-medium">{formatTeachingDates(child.days)}</td><td className="border-b border-r border-slate-200 p-2 text-center">{child.totalHours}</td><td className="border-b border-r border-slate-200 p-2 text-center">{formatMoney(child.salaryPerHour)}</td><td className="border-b border-slate-200 p-2 text-right font-bold">{formatMoney(child.totalSalary)}</td></tr>)}</tbody></table></div>{salaryQrBlock}<p className="mb-0 mt-4 text-center text-[9px] text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p></div><div className="flex items-center justify-end gap-2 border-t border-border pt-4">{paidStatus}<Button type="button" variant="secondary" onClick={() => setReceipt(null)} disabled={copying}>Đóng</Button><Button type="button" onClick={copyReceipt} disabled={copying}>{copying ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}Copy hình</Button>{markPaidButton}</div></div>}
    </Modal>
  </div>
}
