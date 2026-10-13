import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CalendarDays, Check, CheckCircle2, Copy, FileImage, Loader2, Pencil, Table2, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createAttendance, deleteAttendanceDay, type AttendanceType, getMonthlyAttendances, type MonthlyAttendance, setAttendanceCompleted, updateAttendanceDay } from '@/services/apis/attendance-api'
import { getTeachers } from '@/services/apis/teachers-api'

type TypeFilter = AttendanceType | 'ALL'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2019 + 2 },
  (_, index) => 2020 + index,
)
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const CALENDAR_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatBirthDate(value?: string | null) {
  if (!value) return 'Chưa có ngày sinh'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có ngày sinh' : date.toLocaleDateString('vi-VN')
}

const defaultAvatar = (gender?: string) =>
  gender === 'female' ? '/avatars/default-girl.svg' : '/avatars/default-boy.svg'
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`

function attendanceTotals(attendance: MonthlyAttendance) {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  if (attendance.type === 'BAN_TRU') {
    return {
      revenue: (child?.tuitionFee || 0) + (child?.mealFee || 0) + (child?.csvcFee || 0) +
        (child?.drawingFee || 0) + (child?.languageFee || 0) + (child?.movementFee || 0) -
        attendance.days.reduce((total, day) => total + day.refund, 0),
      expense: 0,
    }
  }
  return attendance.days.reduce((total, day) => ({
    revenue: total.revenue + day.spendTime * (day.tuitionFee || child?.salaryOneHourForCenter || 0) - day.refund,
    expense: total.expense + day.spendTime * (day.salaryTeacher || child?.salaryTeacher || 0),
  }), { revenue: 0, expense: 0 })
}

export default function StudentHistoryPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [type, setType] = useState<TypeFilter>('ALL')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('calendar')
  const [childFilter, setChildFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [editingDay, setEditingDay] = useState<{ attendanceId: string; childId: string; attendanceType: AttendanceType; date: string; day: MonthlyAttendance['days'][number]; defaultTeacherId?: string | null } | null>(null)
  const [editSpendTime, setEditSpendTime] = useState('1')
  const [customSpendTime, setCustomSpendTime] = useState(false)
  const [editTeacherId, setEditTeacherId] = useState('')
  const [editAbsent, setEditAbsent] = useState(false)
  const [editRefund, setEditRefund] = useState('0')
  const [editNotes, setEditNotes] = useState('')
  const [editLessonType, setEditLessonType] = useState('HỌC')
  const [customLessonType, setCustomLessonType] = useState(false)
  const [receiptGroup, setReceiptGroup] = useState<{ childId: string; rows: MonthlyAttendance[] } | null>(null)
  const [copyingReceipt, setCopyingReceipt] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [selectedYear, selectedMonth] = month.split('-').map(Number)
  const totalDays = useMemo(
    () => new Date(selectedYear, selectedMonth, 0).getDate(),
    [selectedMonth, selectedYear],
  )
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays])
  const calendarDays = useMemo(() => {
    const firstDayOffset = (new Date(selectedYear, selectedMonth - 1, 1).getDay() + 6) % 7
    return [...Array.from({ length: firstDayOffset }, () => null), ...days]
  }, [days, selectedMonth, selectedYear])
  const weekdayLabel = (day: number) =>
    WEEKDAY_LABELS[new Date(selectedYear, selectedMonth - 1, day).getDay()]
  const attendanceQuery = useQuery({
    queryKey: ['student-history', month, type],
    queryFn: () => getMonthlyAttendances(month, type),
  })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const refreshHistory = () => queryClient.invalidateQueries({ queryKey: ['student-history', month, type] })
  const editModeMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      if (completed) await setAttendanceCompleted(id, false)
      return id
    },
    onSuccess: async (id) => {
      setEditingIds((current) => new Set(current).add(id))
      await refreshHistory()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể mở chỉnh sửa'),
  })
  const finishEditMutation = useMutation({
    mutationFn: (id: string) => setAttendanceCompleted(id, true),
    onSuccess: async (_, id) => {
      setEditingIds((current) => { const next = new Set(current); next.delete(id); return next })
      await refreshHistory()
      toast.success('Đã lưu lịch sử học')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu lịch sử học'),
  })
  const dayMutation = useMutation({
    mutationFn: async ({ attendanceId, childId, date, attendanceType, attended, spendTime, defaultTeacherId, absent, refund, notes, lessonType }: { attendanceId: string; childId: string; date: string; attendanceType: AttendanceType; attended: boolean; spendTime?: number; defaultTeacherId?: string | null; absent?: boolean; refund?: number; notes?: string; lessonType?: string }) => {
      const selectedTeacherId = defaultTeacherId || undefined
      if (!attended) return createAttendance(childId, date, attendanceType === 'BAN_TRU' ? 0 : spendTime || 1, attendanceType, selectedTeacherId)
      if (spendTime !== undefined) return updateAttendanceDay(attendanceId, date, spendTime, attendanceType === 'THEO_BUOI' ? selectedTeacherId : undefined, absent, refund, notes, lessonType)
      return deleteAttendanceDay(childId, date, attendanceType)
    },
    onSuccess: async () => { setEditingDay(null); await refreshHistory(); toast.success('Đã cập nhật ngày học') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật ngày học'),
  })
  const childOptions = useMemo(() => {
    const children = new Map<string, string>()
    for (const attendance of attendanceQuery.data || []) {
      if (typeof attendance.children !== 'string') {
        children.set(attendance.children._id, attendance.children.name)
      }
    }
    return [...children].sort((left, right) => left[1].localeCompare(right[1], 'vi'))
  }, [attendanceQuery.data])
  const teacherOptions = useMemo(() => {
    const teachers = new Map<string, string>()
    for (const attendance of attendanceQuery.data || []) {
      const child = typeof attendance.children === 'string' ? null : attendance.children
      if (child?.teacherId && child.teacherName) teachers.set(child.teacherId, child.teacherName)
      for (const day of attendance.days) {
        if (day.teacherId && day.teacherName) teachers.set(day.teacherId, day.teacherName)
      }
    }
    return [...teachers].sort((left, right) => left[1].localeCompare(right[1], 'vi'))
  }, [attendanceQuery.data])
  const historyRows = useMemo(
    () => (attendanceQuery.data || []).filter((attendance) => {
      const child = typeof attendance.children === 'string' ? null : attendance.children
      const childKeyword = childFilter.trim().toLocaleLowerCase('vi')
      const teacherKeyword = teacherFilter.trim().toLocaleLowerCase('vi')
      if (childKeyword && !child?.name.toLocaleLowerCase('vi').includes(childKeyword)) return false
      if (!teacherKeyword) return true
      const teacherNames = [child?.teacherName, ...attendance.days.map((day) => day.teacherName)]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi')
      return teacherNames.includes(teacherKeyword)
    }).sort((left, right) => {
      const leftId = typeof left.children === 'string' ? left.children : left.children._id
      const rightId = typeof right.children === 'string' ? right.children : right.children._id
      const childOrder = leftId.localeCompare(rightId, 'vi', { numeric: true })
      if (childOrder !== 0) return childOrder
      return left.type === right.type ? 0 : left.type === 'BAN_TRU' ? -1 : 1
    }),
    [attendanceQuery.data, childFilter, teacherFilter],
  )
  const monthlyTotals = useMemo(
    () => historyRows.reduce((total, attendance) => {
      const row = attendanceTotals(attendance)
      return { revenue: total.revenue + row.revenue, expense: total.expense + row.expense }
    }, { revenue: 0, expense: 0 }),
    [historyRows],
  )
  const historyGroups = useMemo(() => {
    const groups = new Map<string, MonthlyAttendance[]>()
    for (const row of historyRows) {
      const childId = typeof row.children === 'string' ? row.children : row.children._id
      groups.set(childId, [...(groups.get(childId) || []), row])
    }
    return [...groups.entries()].map(([childId, rows]) => ({ childId, rows }))
  }, [historyRows])
  const receiptData = useMemo(() => {
    if (!receiptGroup) return null
    const child = typeof receiptGroup.rows[0]?.children === 'string' ? null : receiptGroup.rows[0]?.children
    const totals = receiptGroup.rows.reduce((sum, row) => {
      const rowTotal = attendanceTotals(row)
      return { revenue: sum.revenue + rowTotal.revenue, expense: sum.expense + rowTotal.expense }
    }, { revenue: 0, expense: 0 })
    const days = receiptGroup.rows.flatMap((row) => row.days.map((day) => ({ ...day, attendanceType: row.type })))
      .sort((left, right) => left.date.localeCompare(right.date))
    return {
      child,
      totals,
      days,
      totalHours: days.filter((day) => day.attendanceType === 'THEO_BUOI' && !day.absent).reduce((sum, day) => sum + day.spendTime, 0),
      totalRefund: days.reduce((sum, day) => sum + day.refund, 0),
    }
  }, [receiptGroup])

  const openDayEditor = (attendance: MonthlyAttendance, date: string, item: MonthlyAttendance['days'][number], defaultTeacherId?: string | null) => {
    const value = String(item.spendTime)
    const childId = typeof attendance.children === 'string' ? attendance.children : attendance.children._id
    setEditingDay({ attendanceId: attendance._id, childId, attendanceType: attendance.type, date, day: item, defaultTeacherId })
    setEditSpendTime(value)
    setCustomSpendTime(!['1', '1.5', '2', '2.5', '3'].includes(value))
    setEditTeacherId(item.teacherId || defaultTeacherId || '')
    setEditAbsent(item.absent)
    setEditRefund(String(item.refund || 0))
    setEditNotes(item.notes || '')
    setEditLessonType(item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC'))
    setCustomLessonType(!['HỌC', 'VẼ'].includes(item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC')))
  }
  const copyReceiptImage = async () => {
    if (!receiptRef.current) return
    try {
      setCopyingReceipt(true)
      const blob = await toBlob(receiptRef.current, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true })
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
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="Học Sinh"
        title="Lịch sử học"
        description="Theo dõi ngày học của từng trẻ theo tháng và loại học."
      />

      <Card className="min-w-0 overflow-hidden">
        <CardHeader
          title={`Lịch sử học Tháng ${selectedMonth}/${selectedYear}`}
          description={`${historyRows.length} bảng điểm danh`}
          action={<div className="flex rounded-xl border border-border bg-surface-muted p-1"><Button type="button" size="sm" variant={viewMode === 'table' ? 'primary' : 'ghost'} onClick={() => setViewMode('table')}><Table2 size={14} />Dạng bảng</Button><Button type="button" size="sm" variant={viewMode === 'calendar' ? 'primary' : 'ghost'} onClick={() => setViewMode('calendar')}><CalendarDays size={14} />Dạng lịch</Button></div>}
        />
        <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Tháng
            <select value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">
              {MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Năm
            <select value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">
              {YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Loại học
            <select value={type} onChange={(event) => setType(event.target.value as TypeFilter)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">
              <option value="ALL">Tất cả loại học</option>
              <option value="THEO_BUOI">Học theo buổi</option>
              <option value="BAN_TRU">Học bán trú</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Trẻ
            <input type="search" list="history-child-options" value={childFilter} onChange={(event) => setChildFilter(event.target.value)} placeholder="Tìm theo tên trẻ..." className="h-10 min-w-52 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary" />
            <datalist id="history-child-options">{childOptions.map(([id, name]) => <option key={id} value={name} />)}</datalist>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Giáo viên
            <input type="search" list="history-teacher-options" value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} placeholder="Tìm theo giáo viên..." className="h-10 min-w-52 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary" />
            <datalist id="history-teacher-options">{teacherOptions.map(([id, name]) => <option key={id} value={name} />)}</datalist>
          </label>
        </div>

        {attendanceQuery.isSuccess && <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:px-6"><div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Tổng thu Tháng {selectedMonth}</span><strong className="mt-1 block text-xl text-emerald-700 dark:text-emerald-300">{formatMoney(monthlyTotals.revenue)}</strong></div><div className="rounded-xl bg-red-50 p-4 dark:bg-red-500/10"><span className="text-xs font-semibold text-red-700 dark:text-red-300">Tổng chi Tháng {selectedMonth}</span><strong className="mt-1 block text-xl text-red-700 dark:text-red-300">{formatMoney(monthlyTotals.expense)}</strong></div></div>}

        {attendanceQuery.isLoading && (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={19} className="spin text-primary" />Đang tải lịch sử học...
          </div>
        )}
        {attendanceQuery.isError && (
          <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {attendanceQuery.error instanceof Error ? attendanceQuery.error.message : 'Không thể tải lịch sử học'}
          </div>
        )}
        {attendanceQuery.isSuccess && historyRows.length === 0 && (
          <div className="grid min-h-64 place-items-center text-sm text-muted">Chưa có dữ liệu học trong tháng này.</div>
        )}

        {attendanceQuery.isSuccess && historyRows.length > 0 && viewMode === 'table' && (
          <Table className="w-max min-w-full border-separate border-spacing-0" containerClassName="max-h-[calc(100vh-260px)] max-w-full overflow-auto overscroll-contain">
            <TableHeader className="sticky top-0 z-20 bg-surface-muted shadow-sm">
              <TableRow>
                <TableHead className="sticky left-0 top-0 z-30 w-64 min-w-64 max-w-64 border-r border-border bg-surface-muted shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)]">Trẻ</TableHead>
                <TableHead className="w-40 min-w-40 text-center">Loại học</TableHead>
                {days.map((day) => <TableHead key={day} className="w-24 min-w-24 whitespace-nowrap text-center">{day} - {weekdayLabel(day)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyRows.map((attendance, rowIndex) => {
                const child = typeof attendance.children === 'string' ? null : attendance.children
                const childId = typeof attendance.children === 'string' ? attendance.children : attendance.children._id
                const previousRow = historyRows[rowIndex - 1]
                const previousChildId = previousRow
                  ? typeof previousRow.children === 'string' ? previousRow.children : previousRow.children._id
                  : null
                const showChild = childId !== previousChildId
                const childRows = historyRows.filter((row) =>
                  (typeof row.children === 'string' ? row.children : row.children._id) === childId,
                )
                const childRowCount = childRows.length
                const boardingRow = childRows.find((row) => row.type === 'BAN_TRU')
                const sessionRow = childRows.find((row) => row.type === 'THEO_BUOI')
                const latestDay = (items: typeof attendance.days) => items.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, items[0])
                const boardingSnapshot = latestDay(boardingRow?.days || [])
                const sessionSnapshot = latestDay(sessionRow?.days || [])
                const attendanceByDay = new Map(
                  attendance.days.map((item) => [Number(item.date.slice(8, 10)), item]),
                )
                const rowTotals = attendanceTotals(attendance)
                return (
                  <TableRow key={attendance._id} className="group">
                    {showChild && <TableCell rowSpan={childRowCount} className="sticky left-0 z-10 w-64 min-w-64 max-w-64 border-r border-border bg-surface shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)]">
                      <div className="grid gap-2"><div className="flex items-center gap-3">
                        <img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-11 w-11 shrink-0 rounded-xl bg-surface-muted object-cover" />
                        <div className="min-w-0">
                          <strong className="block max-w-40 whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${attendance.children}`}</strong>
                          <span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span>
                          {sessionRow && <><span className="mt-1 block text-[10px] text-muted">GV: <strong className="text-blue-600 dark:text-blue-400">{child?.teacherName || 'Chưa cập nhật'}</strong></span><span className="block text-[10px] text-muted">Lương GV 1h: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(sessionSnapshot?.salaryTeacher || child?.salaryTeacher || 0)}</strong></span><span className="block text-[10px] text-muted">Học phí 1h: <strong className="text-red-600 dark:text-red-400">{formatMoney(sessionSnapshot?.tuitionFee || child?.salaryOneHourForCenter || 0)}</strong></span></>}
                          {boardingRow && <span className="mt-1 block text-[10px] text-muted">Học phí: {formatMoney(boardingSnapshot?.tuitionFee || child?.tuitionFee || 0)}</span>}
                        </div>
                      </div><Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows: childRows })}><FileImage size={13} />Xuất phiếu</Button></div>
                    </TableCell>}
                    <TableCell className="text-center">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${attendance.type === 'BAN_TRU' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendance.type === 'BAN_TRU' ? 'Bán trú' : 'Theo buổi'}</span>
                      <span className="mx-auto mt-1 block whitespace-nowrap text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">Thu: {formatMoney(rowTotals.revenue)}</span>
                      <span className="mx-auto block whitespace-nowrap text-[10px] font-semibold text-red-600 dark:text-red-300">Chi: {formatMoney(rowTotals.expense)}</span>
                      {attendance.isCompleted && <span className="mx-auto mt-1 flex w-fit items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={10} />Hoàn tất</span>}
                      {editingIds.has(attendance._id) ? <Button type="button" size="sm" className="mx-auto mt-2" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance._id)}><CheckCircle2 size={13} />Xong</Button> : <Button type="button" size="sm" variant="secondary" className="mx-auto mt-2" disabled={editModeMutation.isPending} onClick={() => editModeMutation.mutate({ id: attendance._id, completed: attendance.isCompleted })}><Pencil size={13} />Sửa</Button>}
                    </TableCell>
                    {days.map((day) => {
                      const item = attendanceByDay.get(day)
                      return (
                        <TableCell key={day} className="p-1 text-center">
                          <button type="button" disabled={!editingIds.has(attendance._id) || dayMutation.isPending} onClick={() => {
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            if (item) {
                              openDayEditor(attendance, date, item, child?.teacherId)
                              return
                            }
                            if (attendance.type === 'THEO_BUOI' && !item && !child?.teacherId) return toast.error('Trẻ chưa có giáo viên mặc định')
                            dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: Boolean(item), defaultTeacherId: child?.teacherId })
                          }} className={`mx-auto grid min-h-8 min-w-8 place-items-center rounded-lg px-1 py-1 text-[10px] font-bold transition ${item ? item.absent ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-muted/40'} ${editingIds.has(attendance._id) ? 'cursor-pointer ring-1 ring-primary/30 hover:bg-primary/10' : 'cursor-default'} disabled:opacity-70`} title={editingIds.has(attendance._id) ? item ? 'Bấm để sửa buổi học' : 'Bấm để thêm ngày học' : ''}>{item ? attendance.type === 'BAN_TRU' ? <span><span className="block">{item.absent ? 'Nghỉ' : <Check size={15} />}</span>{item.refund > 0 && <span className="mt-0.5 block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</span> : <span><span className="block">{item.absent ? 'Nghỉ' : `${item.lessonType || 'HỌC'} · ${item.spendTime}h`}</span>{!item.absent && item.teacherName && <span className="mt-0.5 block max-w-20 truncate font-medium">{item.teacherName}</span>}{item.refund > 0 && <span className="mt-0.5 block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</span> : '—'}</button>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        {attendanceQuery.isSuccess && historyRows.length > 0 && viewMode === 'calendar' && (
          <div className="grid divide-y divide-border">
            {historyGroups.map(({ childId, rows }) => {
              const child = typeof rows[0].children === 'string' ? null : rows[0].children
              const sessionRow = rows.find((row) => row.type === 'THEO_BUOI')
              const boardingRow = rows.find((row) => row.type === 'BAN_TRU')
              const sessionSnapshot = sessionRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, sessionRow.days[0])
              const boardingSnapshot = boardingRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, boardingRow.days[0])
              return <div key={childId} className="overflow-x-auto">
                <div className="grid min-w-[700px] grid-cols-[12rem_minmax(490px,1fr)]">
                  <div className="border-r border-border bg-surface-muted/35 p-3">
                    <div className="sticky top-3 grid gap-2"><div className="flex items-start gap-2.5">
                      <img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-10 w-10 shrink-0 rounded-lg bg-surface-muted object-cover" />
                      <div className="min-w-0"><strong className="block whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${childId}`}</strong><span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span>{sessionRow && <><span className="mt-1 block text-xs text-muted">GV: <strong className="text-blue-600 dark:text-blue-400">{child?.teacherName || 'Chưa cập nhật'}</strong></span><span className="mt-0.5 block text-[10px] text-muted">Lương GV 1h: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(sessionSnapshot?.salaryTeacher || child?.salaryTeacher || 0)}</strong></span><span className="mt-0.5 block text-[10px] text-muted">Học phí 1h: <strong className="text-red-600 dark:text-red-400">{formatMoney(sessionSnapshot?.tuitionFee || child?.salaryOneHourForCenter || 0)}</strong></span></>}{boardingRow && <span className="mt-1 block text-[10px] text-muted">Học phí bán trú: <strong className="text-red-600 dark:text-red-400">{formatMoney(boardingSnapshot?.tuitionFee || child?.tuitionFee || 0)}</strong></span>}</div></div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows })}><FileImage size={13} />Xuất phiếu</Button>
                    </div>
                  </div>
                  <div className="grid gap-3 p-3">
                    {rows.map((attendance) => {
                      const rowTotals = attendanceTotals(attendance)
                      const attendanceByDay = new Map(attendance.days.map((item) => [Number(item.date.slice(8, 10)), item]))
                      return <section key={attendance._id} className="grid gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${attendance.type === 'BAN_TRU' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendance.type === 'BAN_TRU' ? 'Bán trú' : 'Theo buổi'}</span><span className="text-xs font-semibold text-emerald-600">Thu: {formatMoney(rowTotals.revenue)}</span><span className="text-xs font-semibold text-red-600">Chi: {formatMoney(rowTotals.expense)}</span>{attendance.isCompleted && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={13} />Hoàn tất</span>}</div>
                          {editingIds.has(attendance._id) ? <Button type="button" size="sm" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance._id)}><CheckCircle2 size={13} />Xong</Button> : <Button type="button" size="sm" variant="secondary" disabled={editModeMutation.isPending} onClick={() => editModeMutation.mutate({ id: attendance._id, completed: attendance.isCompleted })}><Pencil size={13} />Sửa</Button>}
                        </div>
                        <div className="grid grid-cols-7 gap-1">{CALENDAR_WEEKDAYS.map((weekday, weekdayIndex) => <div key={weekday} className={`border-b border-r border-border px-1 py-1.5 text-center text-[13px] font-bold text-muted last:border-r-0 ${weekdayIndex >= 5 ? 'bg-slate-200/80 dark:bg-slate-700/70' : ''}`}>{weekday}</div>)}
                          {calendarDays.map((day, index) => {
                            const isWeekend = index % 7 >= 5
                            if (!day) return <div key={`empty-${index}`} className={isWeekend ? 'min-h-20 rounded-md bg-slate-100 dark:bg-slate-800/70' : 'min-h-20'} />
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            const item = attendanceByDay.get(day)
                            return <button key={date} type="button" disabled={!editingIds.has(attendance._id) || dayMutation.isPending} onClick={() => {
                              if (item) return openDayEditor(attendance, date, item, child?.teacherId)
                              if (attendance.type === 'THEO_BUOI' && !child?.teacherId) return toast.error('Trẻ chưa có giáo viên mặc định')
                              dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: false, defaultTeacherId: child?.teacherId })
                            }} className={`relative flex min-h-20 flex-col overflow-hidden rounded-md border p-1.5 pt-6 text-left transition ${item ? item.absent ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-surface'} ${isWeekend ? '!bg-slate-100 dark:!bg-slate-800/80' : ''} ${editingIds.has(attendance._id) ? 'cursor-pointer hover:border-primary/50 hover:ring-1 hover:ring-primary/20' : 'cursor-default'} disabled:opacity-80`} title={editingIds.has(attendance._id) ? item ? 'Bấm để chỉnh sửa' : 'Bấm để điểm danh' : ''}>
                              <span className="absolute left-1.5 top-1 text-base font-bold">{day}</span>{item && <><CalendarCheck size={15} className="absolute right-1.5 top-1.5" /><span className="mt-auto block min-w-0 text-xs font-semibold leading-snug"><span className="block">{item.absent ? 'Nghỉ' : attendance.type === 'BAN_TRU' ? 'Đã học' : `${item.lessonType || 'HỌC'} · ${item.spendTime} giờ`}</span>{!item.absent && item.teacherName && <span className="block truncate opacity-80">{item.teacherName}</span>}{item.refund > 0 && <span className="block truncate text-red-600">Hoàn {formatMoney(item.refund)}</span>}{item.notes && item.notes.trim().toLocaleUpperCase('vi') !== (item.lessonType || 'HỌC').trim().toLocaleUpperCase('vi') && <span className="block truncate text-[11px] font-normal opacity-75">{item.notes}</span>}</span></>}
                            </button>
                          })}
                        </div>
                      </section>
                    })}
                  </div>
                </div>
              </div>
            })}
          </div>
        )}
      </Card>
      <Modal open={Boolean(receiptGroup)} onClose={() => !copyingReceipt && setReceiptGroup(null)} title="Xuất phiếu" className="max-h-[92vh] max-w-4xl overflow-auto">
        {receiptData && <div className="grid gap-4">
          <div ref={receiptRef} className="mx-auto w-[700px] bg-white p-5 text-slate-900">
            <div className="border-b-2 border-emerald-500 pb-3 text-center"><h2 className="m-0 text-2xl font-bold">PHIẾU THÔNG TIN HỌC</h2></div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-4 rounded-xl bg-slate-50 p-3"><div><strong className="block text-xl">{receiptData.child?.name || `Trẻ #${receiptGroup?.childId}`}</strong><span className="block text-sm text-slate-600">Ngày sinh: {formatBirthDate(receiptData.child?.birthDate)} · GV: {receiptData.child?.teacherName || 'Chưa cập nhật'}</span></div><div className="text-right"><strong className="block text-2xl text-emerald-600">{receiptData.days.length} buổi</strong>{receiptData.totalHours > 0 && <span className="text-sm text-slate-500">{receiptData.totalHours} giờ học</span>}</div></div>
            <div className={`mt-3 grid gap-2 ${receiptData.totalRefund > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><span className="text-xs font-semibold text-emerald-700">Tổng học phí</span><strong className="block text-base text-emerald-700">{formatMoney(receiptData.totals.revenue)}</strong></div>{receiptData.totalRefund > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3"><span className="text-xs font-semibold text-red-700">Hoàn tiền</span><strong className="block text-base text-red-700">{formatMoney(receiptData.totalRefund)}</strong></div>}</div>
            <h3 className="mb-1.5 mt-3 text-sm font-bold uppercase text-slate-700">Lịch học Tháng {selectedMonth}/{selectedYear}</h3>
            <div className="grid grid-cols-7 border-l border-t border-slate-300">{CALENDAR_WEEKDAYS.map((weekday) => <div key={weekday} className="border-b border-r border-slate-300 bg-slate-100 px-1 py-2 text-center text-xs font-bold">{weekday}</div>)}{calendarDays.map((day, index) => {
              if (!day) return <div key={`receipt-empty-${index}`} className="min-h-20 border-b border-r border-slate-300 bg-slate-50" />
              const items = receiptData.days.filter((item) => Number(item.date.slice(8, 10)) === day)
              return <div key={`receipt-${day}`} className={`min-h-20 border-b border-r border-slate-300 p-1.5 ${items.some((item) => !item.absent) ? 'bg-emerald-50' : items.some((item) => item.absent) ? 'bg-amber-50' : 'bg-white'}`}><strong className="block text-sm">{day}</strong>{items.map((item) => <div key={`${item.attendanceType}-${item.date}`} className={`mt-1 text-[11px] leading-snug ${item.absent ? 'text-amber-700' : 'text-emerald-700'}`}><strong>{item.absent ? 'Nghỉ' : item.attendanceType === 'BAN_TRU' ? 'Học' : `${item.lessonType || 'HỌC'} · ${item.spendTime}h`}</strong>{item.refund > 0 && <span className="block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</div>)}</div>
            })}</div>
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-blue-900"><strong className="block text-base">Thông tin chuyển khoản</strong><span className="mt-1 block">Ngân hàng: Vietcombank</span><span className="block">Số tài khoản: <strong>1057884906</strong></span><span className="block">Chủ tài khoản: <strong>CTY TNHH TV VA HO TRO GIAO DUC NANG MAI</strong></span><span className="block">Nội dung: <strong>Tên Bé</strong></span></div>
            <p className="mb-0 mt-3 text-center text-xs text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p>
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface pt-4"><Button type="button" variant="secondary" disabled={copyingReceipt} onClick={() => setReceiptGroup(null)}>Đóng</Button><Button type="button" disabled={copyingReceipt} onClick={copyReceiptImage}>{copyingReceipt ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}Copy hình</Button></div>
        </div>}
      </Modal>
      <Modal
        open={Boolean(editingDay)}
        onClose={() => !dayMutation.isPending && setEditingDay(null)}
        title="Chỉnh sửa buổi học"
        description={editingDay ? new Date(`${editingDay.date}T00:00:00`).toLocaleDateString('vi-VN') : undefined}
      >
        <form onSubmit={(event) => {
          event.preventDefault()
          if (!editingDay) return
          const spendTime = Number(editSpendTime.replace(',', '.'))
          const refund = Number(editRefund) || 0
          if (editingDay.attendanceType === 'THEO_BUOI' && (!Number.isFinite(spendTime) || spendTime <= 0)) return toast.error('Số giờ học không hợp lệ')
          if (refund < 0) return toast.error('Số tiền hoàn không hợp lệ')
          dayMutation.mutate({
            attendanceId: editingDay.attendanceId,
            childId: '',
            date: editingDay.date,
            attendanceType: editingDay.attendanceType,
            attended: true,
            spendTime: editingDay.attendanceType === 'BAN_TRU' ? 0 : spendTime,
            defaultTeacherId: editTeacherId || editingDay.defaultTeacherId,
            absent: editAbsent,
            refund,
            notes: editNotes.trim(),
            lessonType: editLessonType.trim() || 'HỌC',
          })
        }} className="grid gap-5">
          {editingDay?.attendanceType === 'THEO_BUOI' && <label className="grid gap-2 text-sm font-semibold">
            Loại buổi học
            <span className="flex flex-wrap gap-2">
              {['HỌC', 'VẼ'].map((lessonType) => <button key={lessonType} type="button" onClick={() => { setEditLessonType(lessonType); setCustomLessonType(false) }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${!customLessonType && editLessonType === lessonType ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>{lessonType === 'HỌC' ? 'Học' : 'Vẽ'}</button>)}
              <button type="button" onClick={() => { setCustomLessonType(true); if (['HỌC', 'VẼ'].includes(editLessonType)) setEditLessonType('') }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${customLessonType ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>Khác</button>
            </span>
            {customLessonType && <input value={editLessonType} onChange={(event) => setEditLessonType(event.target.value.toLocaleUpperCase('vi'))} placeholder="Nhập loại buổi học" className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />}
          </label>}
          {editingDay?.attendanceType === 'THEO_BUOI' && <label className="grid gap-2 text-sm font-semibold">
            Thời lượng
            <span className="flex flex-wrap gap-2">
              {[1, 1.5, 2, 2.5, 3].map((hours) => <button key={hours} type="button" onClick={() => { setEditSpendTime(String(hours)); setCustomSpendTime(false) }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${!customSpendTime && editSpendTime === String(hours) ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>{hours}h</button>)}
              <button type="button" onClick={() => setCustomSpendTime(true)} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${customSpendTime ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>Tùy chỉnh</button>
            </span>
            {customSpendTime && <input value={editSpendTime} onChange={(event) => setEditSpendTime(event.target.value)} inputMode="decimal" placeholder="Nhập số giờ" className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />}
          </label>}
          {editingDay?.attendanceType === 'THEO_BUOI' && <label className="grid gap-2 text-sm font-semibold">
            Giáo viên
            <select value={editTeacherId} onChange={(event) => setEditTeacherId(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary">
              <option value="">Chọn giáo viên</option>
              {(teachersQuery.data || []).filter((teacher) => teacher.active).map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}
            </select>
          </label>}
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
            <input type="checkbox" checked={editAbsent} onChange={(event) => setEditAbsent(event.target.checked)} className="h-4 w-4 accent-primary" />
            Bé nghỉ buổi này
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Hoàn tiền (refund)
            <input type="number" min="0" step="1000" value={editRefund} onChange={(event) => setEditRefund(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Ghi chú
            <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} placeholder="Nhập ghi chú cho ngày này" className="rounded-xl border border-border bg-app-background px-3 py-2 font-normal outline-none focus:border-primary" />
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="danger" className="mr-auto" disabled={dayMutation.isPending} onClick={() => {
              if (!editingDay || !window.confirm('Xóa buổi học này? Dữ liệu của ngày đã chọn sẽ bị xóa.')) return
              dayMutation.mutate({ attendanceId: editingDay.attendanceId, childId: editingDay.childId, date: editingDay.date, attendanceType: editingDay.attendanceType, attended: true })
            }}><Trash2 size={16} />Xóa buổi học</Button>
            <Button type="button" variant="secondary" onClick={() => setEditingDay(null)} disabled={dayMutation.isPending}>Hủy</Button>
            <Button type="submit" disabled={dayMutation.isPending}>{dayMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
