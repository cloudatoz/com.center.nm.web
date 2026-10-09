import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createAttendance, deleteAttendanceDay, type AttendanceType, getMonthlyAttendances, type MonthlyAttendance, setAttendanceCompleted, updateAttendanceDay } from '@/services/apis/attendance-api'

type TypeFilter = AttendanceType | 'ALL'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2019 + 2 },
  (_, index) => 2020 + index,
)
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

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
        (child?.drawingFee || 0) + (child?.languageFee || 0) + (child?.movementFee || 0),
      expense: 0,
    }
  }
  return attendance.days.reduce((total, day) => ({
    revenue: total.revenue + day.spendTime * (day.tuitionFee || child?.salaryOneHourForCenter || 0),
    expense: total.expense + day.spendTime * (day.salaryTeacher || child?.salaryTeacher || 0),
  }), { revenue: 0, expense: 0 })
}

export default function StudentHistoryPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [type, setType] = useState<TypeFilter>('ALL')
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set())
  const [selectedYear, selectedMonth] = month.split('-').map(Number)
  const totalDays = useMemo(
    () => new Date(selectedYear, selectedMonth, 0).getDate(),
    [selectedMonth, selectedYear],
  )
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays])
  const weekdayLabel = (day: number) =>
    WEEKDAY_LABELS[new Date(selectedYear, selectedMonth - 1, day).getDay()]
  const attendanceQuery = useQuery({
    queryKey: ['student-history', month, type],
    queryFn: () => getMonthlyAttendances(month, type),
  })
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
    mutationFn: async ({ attendanceId, childId, date, attendanceType, attended, spendTime, defaultTeacherId }: { attendanceId: string; childId: string; date: string; attendanceType: AttendanceType; attended: boolean; spendTime?: number; defaultTeacherId?: string | null }) => {
      const selectedTeacherId = defaultTeacherId || undefined
      if (!attended) return createAttendance(childId, date, attendanceType === 'BAN_TRU' ? 0 : spendTime || 1, attendanceType, selectedTeacherId)
      if (attendanceType === 'THEO_BUOI' && spendTime !== undefined) return updateAttendanceDay(attendanceId, date, spendTime, selectedTeacherId)
      return deleteAttendanceDay(childId, date, attendanceType)
    },
    onSuccess: async () => { await refreshHistory(); toast.success('Đã cập nhật ngày học') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật ngày học'),
  })
  const historyRows = useMemo(
    () => [...(attendanceQuery.data || [])].sort((left, right) => {
      const leftId = typeof left.children === 'string' ? left.children : left.children._id
      const rightId = typeof right.children === 'string' ? right.children : right.children._id
      const childOrder = leftId.localeCompare(rightId, 'vi', { numeric: true })
      if (childOrder !== 0) return childOrder
      return left.type === right.type ? 0 : left.type === 'BAN_TRU' ? -1 : 1
    }),
    [attendanceQuery.data],
  )
  const monthlyTotals = useMemo(
    () => historyRows.reduce((total, attendance) => {
      const row = attendanceTotals(attendance)
      return { revenue: total.revenue + row.revenue, expense: total.expense + row.expense }
    }, { revenue: 0, expense: 0 }),
    [historyRows],
  )

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

        {attendanceQuery.isSuccess && historyRows.length > 0 && (
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
                      <div className="flex items-center gap-3">
                        <img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-11 w-11 shrink-0 rounded-xl bg-surface-muted object-cover" />
                        <div className="min-w-0">
                          <strong className="block max-w-40 truncate">{child?.name || `Trẻ #${attendance.children}`}</strong>
                          <span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span>
                          {sessionRow && <><span className="mt-1 block text-[10px] text-muted">GV: {child?.teacherName || 'Chưa cập nhật'}</span><span className="block text-[10px] text-muted">Lương GV 1h: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(sessionSnapshot?.salaryTeacher || child?.salaryTeacher || 0)}</strong></span><span className="block text-[10px] text-muted">Học phí 1h: <strong className="text-red-600 dark:text-red-400">{formatMoney(sessionSnapshot?.tuitionFee || child?.salaryOneHourForCenter || 0)}</strong></span></>}
                          {boardingRow && <span className="mt-1 block text-[10px] text-muted">Học phí: {formatMoney(boardingSnapshot?.tuitionFee || child?.tuitionFee || 0)}</span>}
                        </div>
                      </div>
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
                            if (item && attendance.type === 'THEO_BUOI') {
                              const value = window.prompt('Nhập số giờ học:', String(item.spendTime))
                              if (value === null) return
                              const spendTime = Number(value.replace(',', '.'))
                              if (!Number.isFinite(spendTime) || spendTime <= 0) return toast.error('Số giờ học không hợp lệ')
                              dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: true, spendTime, defaultTeacherId: child?.teacherId })
                              return
                            }
                            if (attendance.type === 'THEO_BUOI' && !item && !child?.teacherId) return toast.error('Trẻ chưa có giáo viên mặc định')
                            dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: Boolean(item), defaultTeacherId: child?.teacherId })
                          }} className={`mx-auto grid min-h-8 min-w-8 place-items-center rounded-lg px-1 py-1 text-[10px] font-bold transition ${item ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-muted/40'} ${editingIds.has(attendance._id) ? 'cursor-pointer ring-1 ring-primary/30 hover:bg-primary/10' : 'cursor-default'} disabled:opacity-70`} title={editingIds.has(attendance._id) ? item && attendance.type === 'THEO_BUOI' ? 'Bấm để sửa số giờ' : item ? 'Bấm để bỏ ngày học' : 'Bấm để thêm ngày học' : ''}>{item ? attendance.type === 'BAN_TRU' ? <Check size={15} /> : <span><span className="block">{item.spendTime}h</span>{item.teacherName && <span className="mt-0.5 block max-w-20 truncate font-medium">{item.teacherName}</span>}</span> : '—'}</button>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
