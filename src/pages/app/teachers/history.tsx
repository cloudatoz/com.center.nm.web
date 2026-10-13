import { useQuery } from '@tanstack/react-query'
import { Copy, FileImage, Loader2, Search, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMonthlyAttendances, type MonthlyAttendance } from '@/services/apis/attendance-api'
import { getSalaryMonth } from '@/services/apis/teachers-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const currentMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
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
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [receipt, setReceipt] = useState<TeacherTeachingGroup | null>(null)
  const [copying, setCopying] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [selectedYear, selectedMonth] = month.split('-').map(Number)
  const attendanceQuery = useQuery({ queryKey: ['teacher-history', month], queryFn: () => getMonthlyAttendances(month, 'ALL') })
  const salaryMonthQuery = useQuery({ queryKey: ['salary-month', month], queryFn: () => getSalaryMonth(month) })
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
        const childGroup = children.get(attendance.children._id) || { child: attendance.children, days: [], salaryPerHour: 0, totalHours: 0, totalSalary: 0 }
        childGroup.days.push(day)
        childGroup.totalHours += day.spendTime
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

  return <div className="grid gap-6">
    <PageHeader eyebrow="Giáo Viên" title="Lịch sử dạy" description="Tổng hợp các trẻ đã dạy, số giờ và tiền lương theo từng giáo viên." />
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4 sm:px-6">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
        <label className="relative min-w-60 flex-1"><span className="sr-only">Tìm kiếm</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm giáo viên hoặc trẻ..." className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
        <div className="ml-auto rounded-xl bg-primary/10 px-4 py-2"><span className="block text-[10px] font-semibold uppercase text-muted">Tổng lương theo buổi</span><strong className="text-lg text-primary">{formatMoney(totalSalary)}</strong></div>
      </div>
    </Card>
    {salaryMonthQuery.isLoading && <Card className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tải lương cố định tháng...</Card>}
    {salaryMonthQuery.isSuccess && fixedSalaryGroups.length > 0 && <Card className="overflow-hidden">
      <CardHeader title={`Lương cố định Tháng ${selectedMonth}/${selectedYear}`} description={`${fixedSalaryGroups.length} giáo viên hưởng lương theo tháng`} action={<strong className="text-primary">{formatMoney(fixedSalaryGroups.reduce((sum, salary) => sum + salary.totalSalary, 0))}</strong>} />
      <Table><TableHeader><TableRow><TableHead>Giáo viên</TableHead><TableHead>Trẻ và ngày dạy</TableHead><TableHead>Số giờ</TableHead><TableHead>Lương cơ bản</TableHead><TableHead>Bảo hiểm</TableHead><TableHead>Chuyên cần</TableHead><TableHead>Lương khác</TableHead><TableHead className="text-right">Tổng lương</TableHead></TableRow></TableHeader><TableBody>{fixedSalaryGroups.map((salary) => <TableRow key={salary.teacherId}><TableCell className="font-semibold text-blue-600">{salary.teacherName}</TableCell><TableCell>{salary.children.length ? <div className="grid min-w-52 gap-1">{salary.children.map((child) => <span key={child.child._id}><strong>{child.child.name}:</strong> {formatTeachingDates(child.days)}</span>)}</div> : '—'}</TableCell><TableCell className="whitespace-nowrap">{salary.totalHours ? `${salary.totalHours} giờ` : '—'}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.baseSalary)}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.insuranceSupport)}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.attendanceBonus)}</TableCell><TableCell className="whitespace-nowrap">{formatMoney(salary.otherSalary)}</TableCell><TableCell className="whitespace-nowrap text-right font-bold text-primary">{formatMoney(salary.totalSalary)}</TableCell></TableRow>)}</TableBody></Table>
    </Card>}
    {attendanceQuery.isLoading && <Card className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tổng hợp lịch sử dạy...</Card>}
    {attendanceQuery.isError && <Card className="p-5 text-sm text-red-700">Không thể tải lịch sử dạy.</Card>}
    {attendanceQuery.isSuccess && filteredGroups.length === 0 && <Card className="grid min-h-56 place-items-center text-center text-muted"><div><Users size={34} className="mx-auto" /><p>Chưa có dữ liệu dạy trong tháng này.</p></div></Card>}
    {filteredGroups.map((group) => <Card key={group.teacherId} className="overflow-hidden">
      <CardHeader title={group.teacherName} description={`${group.children.length} trẻ · ${group.totalHours} giờ`} action={<div className="flex items-center gap-3"><strong className="text-primary">{formatMoney(group.totalSalary)}</strong><Button type="button" size="sm" variant="secondary" onClick={() => setReceipt(group)}><FileImage size={14} />Xuất phiếu</Button></div>} />
      <Table><TableHeader><TableRow><TableHead>Tên trẻ</TableHead><TableHead>Ngày dạy</TableHead><TableHead>Số giờ</TableHead><TableHead>1h</TableHead><TableHead className="text-right">Tiền lương</TableHead></TableRow></TableHeader><TableBody>{group.children.map((child) => <TableRow key={child.child._id}><TableCell className="font-semibold">{child.child.name}</TableCell><TableCell className="font-medium">{formatTeachingDates(child.days)}</TableCell><TableCell>{child.totalHours} giờ</TableCell><TableCell className="whitespace-nowrap">{formatMoney(child.salaryPerHour)}</TableCell><TableCell className="text-right font-bold text-primary">{formatMoney(child.totalSalary)}</TableCell></TableRow>)}</TableBody></Table>
    </Card>)}
    <Modal open={Boolean(receipt)} onClose={() => !copying && setReceipt(null)} title="Xuất phiếu lương" className="max-h-[92vh] max-w-4xl overflow-auto">
      {receipt && <div className="grid gap-4"><div ref={receiptRef} className="mx-auto w-[760px] bg-white p-6 text-slate-900"><div className="border-b-2 border-primary pb-3 text-center"><h2 className="m-0 text-xl font-bold">PHIẾU TỔNG HỢP LỊCH SỬ DẠY</h2></div><div className="mt-4 flex items-end justify-between rounded-xl bg-slate-50 p-4"><div><span className="text-xs text-slate-500">Giáo viên</span><strong className="block text-xl">{receipt.teacherName}</strong><span className="text-xs text-slate-500">Tháng {selectedMonth}/{selectedYear}</span></div><div className="text-right"><strong className="block text-xl text-blue-600">{formatMoney(receipt.totalSalary)}</strong><span className="text-xs text-slate-500">{receipt.totalHours} giờ</span></div></div><h3 className="mb-2 mt-4 text-xs font-bold uppercase text-slate-600">Các trẻ đã dạy</h3><div className="overflow-hidden rounded-lg border border-slate-300"><table className="w-full border-collapse text-xs"><thead className="bg-slate-100"><tr><th className="border-b border-r border-slate-300 p-2 text-left">Tên trẻ</th><th className="border-b border-r border-slate-300 p-2 text-left">Ngày dạy</th><th className="border-b border-r border-slate-300 p-2">Giờ</th><th className="border-b border-r border-slate-300 p-2">1h</th><th className="border-b border-slate-300 p-2 text-right">Tiền lương</th></tr></thead><tbody>{receipt.children.map((child) => <tr key={child.child._id}><td className="border-b border-r border-slate-200 p-2 font-semibold">{child.child.name}</td><td className="border-b border-r border-slate-200 p-2 font-medium">{formatTeachingDates(child.days)}</td><td className="border-b border-r border-slate-200 p-2 text-center">{child.totalHours}</td><td className="border-b border-r border-slate-200 p-2 text-center">{formatMoney(child.salaryPerHour)}</td><td className="border-b border-slate-200 p-2 text-right font-bold">{formatMoney(child.totalSalary)}</td></tr>)}</tbody></table></div><p className="mb-0 mt-4 text-center text-[9px] text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setReceipt(null)} disabled={copying}>Đóng</Button><Button type="button" onClick={copyReceipt} disabled={copying}>{copying ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}Copy hình</Button></div></div>}
    </Modal>
  </div>
}
