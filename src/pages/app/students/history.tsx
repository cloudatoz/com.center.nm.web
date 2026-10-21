import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown, BookOpenText, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, FileImage, Loader2, Pencil, Search, Send, Trash2, XCircle } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { boardingTotal, configForAttendance, lessonConfigType, schedulesForDate } from '@/lib/child-pricing'
import { getAccountBanks, getVietQrImage } from '@/services/apis/account-bank-api'
import { createAttendance, deleteAttendanceDay, type AttendanceType, getMonthlyAttendances, type MonthlyAttendance, setAttendanceCompleted, updateAttendanceDay, updateAttendanceNote } from '@/services/apis/attendance-api'
import { type Child, type ChildTypeCode, getChildren, updateChild } from '@/services/apis/children-api'
import { getPlans } from '@/services/apis/plan-api'
import { getTeachers } from '@/services/apis/teachers-api'
import { useAuthStore } from '@/stores/auth-store'
import { ChildAgeEditor, readChildAges } from './child-age-editor'
import { ChildTypeEditor, readTypeConfigs } from './child-type-editor'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from(
  { length: Math.max(new Date().getFullYear() - 2026 + 2, 1) },
  (_, index) => 2026 + index,
)
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const CALENDAR_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const CASH_PAYMENT = 'CASH'
const FIND_TEACHER_BUTTON_CLASS = 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25'
const LESSON_TYPES = [
  ['HỌC', 'Học'], ['VẼ', 'Vẽ'], ['NGOẠI NGỮ', 'Ngoại ngữ'], ['VẬN ĐỘNG', 'Vận động'],
] as const
const DURATION_PRESETS = [
  { minutes: 60, label: '1h' }, { minutes: 70, label: '1h10' }, { minutes: 75, label: '1h15' },
  { minutes: 90, label: '1h30' }, { minutes: 120, label: '2h' }, { minutes: 150, label: '2h30' }, { minutes: 180, label: '3h' },
]
const isFullDayType = (type: AttendanceType) => type === 'CA_NGAY' || type === 'SHADOW'
const needsTeacher = (type: AttendanceType) => type !== 'CA_NGAY'
const attendanceTypeLabel = (type: AttendanceType) => ({
  THEO_BUOI: 'Cá nhân', CA_NGAY: 'Cả ngày', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow',
})[type]
const childTypeLabel = (type: ChildTypeCode) => ({
  CA_NGAY: 'Cả ngày',
  CA_NHAN: 'Cá nhân',
  TAI_NHA: 'Tại nhà',
  SHADOW: 'Shadow',
  CA_NHAN_DRAW: 'Cá nhân Vẽ',
  CA_NHAN_LANGUAGE: 'Cá nhân Ngoại ngữ',
  CA_NHAN_MOVEMENT: 'Cá nhân Vận động',
})[type]
const teacherTypeLabel = (type: string) => ({ CA_NGAY: 'Cả ngày', THEO_BUOI: 'Theo buổi', CA_NHAN: 'Trung tâm', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow', ASSISTANT: 'Trợ lý', BEP: 'Bếp' } as Record<string, string>)[type] || type
const childTypeText = (child?: Child | null) => child?.type.map((config) => childTypeLabel(config.type)).join(' · ') || 'Chưa có loại học'

function AttendanceStatusList({ rows }: { rows: MonthlyAttendance[] }) {
  return <div className="grid gap-1 rounded-lg border border-border bg-app-background p-2">
    <strong className="text-xs text-text-main">Điểm danh</strong>
    {rows.map((row) => <span key={row._id} className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold">
      {row.isCompleted ? <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-300" /> : <XCircle size={13} className="text-red-600 dark:text-red-300" />}
      <span className={isFullDayType(row.type) ? 'text-blue-600 dark:text-blue-300' : 'text-purple-600 dark:text-purple-300'}>{attendanceTypeLabel(row.type)}</span>
      <span className={row.isCompleted ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}>: {row.isCompleted ? 'Hoàn thành' : 'Chưa'}</span>
    </span>)}
  </div>
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function teacherMonthOptions() {
  const now = new Date()
  return [-1, 0, 1].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { value, label: `Tháng ${date.getMonth() + 1}/${date.getFullYear()}` }
  })
}

function formatBirthDate(value?: string | null) {
  if (!value) return 'Chưa có ngày sinh'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có ngày sinh' : date.toLocaleDateString('vi-VN')
}

function formatDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const defaultAvatar = (gender?: string) =>
  gender === 'female' ? '/avatars/default-girl.svg' : '/avatars/default-boy.svg'
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
const durationMinutes = (hours: number | string) => Math.max(Math.round((Number(hours) || 0) * 60), 0)
const formatDuration = (hours: number | string) => {
  const minutes = durationMinutes(hours)
  const wholeHours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${wholeHours > 0 ? `${wholeHours}h` : ''}${remainingMinutes > 0 ? `${remainingMinutes}'` : ''}` || "0'"
}
type AttendanceDay = MonthlyAttendance['days'][number]
const uniqueAttendanceTeachers = (days: AttendanceDay[]) => {
  const teachers = new Map<string, { id: string; name: string; salary: number }>()
  for (const day of days) {
    if (day.absent || (!day.teacherId && !day.teacherName)) continue
    const key = day.teacherId || day.teacherName || ''
    teachers.set(key, { id: key, name: day.teacherName || `GV #${day.teacherId}`, salary: day.salaryTeacher || 0 })
  }
  return [...teachers.values()]
}
const attendanceTeacherNames = (days: AttendanceDay[], scheduledTeacherNames = '') =>
  uniqueAttendanceTeachers(days).map((teacher) => teacher.name).join(', ') || scheduledTeacherNames || 'Chưa có dữ liệu điểm danh'
const groupDaysByDate = (days: AttendanceDay[]) => {
  const grouped = new Map<number, AttendanceDay[]>()
  for (const item of days) {
    const day = Number(item.date.slice(8, 10))
    grouped.set(day, [...(grouped.get(day) || []), item])
  }
  return grouped
}
const attendanceDurationPlaceholder = (days: AttendanceDay[], type: AttendanceType) => {
  const grouped = new Map<number, Set<number>>()
  const absentDays = new Set<number>()
  for (const item of days) {
    if (item.absent || item.status === 'absent') {
      absentDays.add(Number(item.date.slice(8, 10)))
      continue
    }
    const minutes = isFullDayType(type) ? 0 : durationMinutes(item.spendTime)
    if (!grouped.has(minutes)) grouped.set(minutes, new Set())
    grouped.get(minutes)?.add(Number(item.date.slice(8, 10)))
  }
  const lines = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([minutes, dayNumbers]) => {
      const duration = isFullDayType(type) ? 'Cả ngày' : formatDuration(minutes / 60)
      return `${duration}: ${[...dayNumbers].sort((left, right) => left - right).join(', ')}`
    })
  if (absentDays.size > 0) lines.push(`Nghỉ: ${[...absentDays].sort((left, right) => left - right).join(', ')}`)
  return lines.join('\n') || 'Chưa có ngày học trong tháng này'
}
const sessionTeacherNames = (items: AttendanceDay[]) => [...new Set(items.map((item) => item.teacherName).filter(Boolean))].join(', ')
const scheduledTeacherIds = (config: Parameters<typeof schedulesForDate>[0], date: string) =>
  schedulesForDate(config, date).map((schedule) => schedule.teacherId).filter((id): id is string => Boolean(id))
const attendanceTeacherIds = (attendance: MonthlyAttendance) => {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  return [
    ...(child?.type || []).flatMap((config) => config.schedules.map((schedule) => schedule.teacherId)),
    ...attendance.days.map((day) => day.teacherId),
  ].filter((id): id is string => Boolean(id)).map(String)
}

function TeacherSalaryLines({ days, selectedTeacherId, onSelect, monthlyTotal = false }: { days: AttendanceDay[]; selectedTeacherId?: string; onSelect?: (teacherId: string) => void; monthlyTotal?: boolean }) {
  const teachers = uniqueAttendanceTeachers(days)
  if (!teachers.length) return <span>{monthlyTotal ? 'Tổng lương GV' : 'Lương GV 1h'}: <strong className="text-blue-600 dark:text-blue-400">Chưa có dữ liệu</strong></span>
  const latestTeacher = [...days]
    .filter((day) => !day.absent && (day.teacherId || day.teacherName))
    .sort((left, right) => right.date.localeCompare(left.date))[0]
  const currentKey = selectedTeacherId || latestTeacher?.teacherId || latestTeacher?.teacherName
  return <span className="grid w-full gap-1">{teachers.map((teacher) => {
    const isCurrent = teacher.id === currentKey
    return <button type="button" key={teacher.id} onClick={() => onSelect?.(teacher.id)} className={`block w-full cursor-pointer rounded-r-md border-l-2 px-2 py-1 text-left transition hover:ring-1 hover:ring-blue-300 ${isCurrent ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30' : 'border-blue-500 bg-blue-50/80 text-slate-700 dark:bg-blue-500/10 dark:text-slate-200'}`}>
      <span className="flex flex-wrap items-center justify-between gap-1"><span>{monthlyTotal ? 'Tổng lương GV' : 'Lương GV 1h'} ({teacher.name}): <strong className="text-blue-600 dark:text-blue-400">{formatMoney(teacher.salary)}</strong></span>{isCurrent && <strong className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] text-white">Đang chọn</strong>}</span>
    </button>
  })}</span>
}
function attendanceTotals(attendance: MonthlyAttendance) {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  if (isFullDayType(attendance.type)) {
    const refunds = attendance.days.reduce((total, day) => total + day.refund, 0)
    const shadowTeacherSalary = [...new Map(attendance.days.filter((day) => !day.absent && day.teacherId).map((day) => [day.teacherId, day.salaryTeacher])).values()].reduce((sum, salary) => sum + salary, 0)
    return {
      revenue: attendance.type === 'CA_NGAY' ? boardingTotal(child) - refunds : (attendance.days.find((day) => day.tuitionFee > 0)?.tuitionFee || 0) - refunds,
      expense: attendance.type === 'CA_NGAY' ? 0 : shadowTeacherSalary,
    }
  }
  return attendance.days.reduce((total, day) => ({
    revenue: total.revenue + day.spendTime * day.tuitionFee - day.refund,
    expense: total.expense + day.spendTime * day.salaryTeacher,
  }), { revenue: 0, expense: 0 })
}

export default function StudentHistoryPage() {
  const queryClient = useQueryClient()
  const isTeacherSession = useAuthStore((state) => state.session?.user.role === 'teacher')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedMonth = searchParams.get('month')
  const [month, setMonth] = useState(() => requestedMonth && /^(202[6-9]|20[3-9]\d|2[1-9]\d{2})-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth())
  useEffect(() => {
    if (isTeacherSession && !teacherMonthOptions().some((option) => option.value === month)) setMonth(currentMonth())
  }, [isTeacherSession, month])
  const openChildPlan = (childId?: string) => {
    if (!childId) return toast.error('Không tìm thấy trẻ')
    navigate(`/students/plans?childId=${childId}&month=${month}`)
  }
  const type = 'ALL' as const
  const [viewMode] = useState<'table' | 'calendar'>('calendar')
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set())
  const initializedChildSelection = useRef(false)
  const [childSearch, setChildSearch] = useState('')
  const [isChildPickerCollapsed, setIsChildPickerCollapsed] = useState(false)
  const [sortChildrenByType, setSortChildrenByType] = useState(false)
  const [teacherFilter, setTeacherFilter] = useState(() => searchParams.get('teacher')?.trim() || '')
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
  const [selectedBankId, setSelectedBankId] = useState('')
  const [findingTeacherFor, setFindingTeacherFor] = useState<{ child: Child; childName: string; typeCode: ChildTypeCode; teacherId?: string | null } | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherHourlySalary, setTeacherHourlySalary] = useState('130000')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedAttendanceTeachers, setSelectedAttendanceTeachers] = useState<Record<string, string>>({})
  const [attendanceConfirmation, setAttendanceConfirmation] = useState<{ attendanceId: string; childName: string } | null>(null)
  const attendanceConfirmResolver = useRef<((confirmed: boolean) => void) | null>(null)
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
  const childrenQuery = useQuery({
    queryKey: ['children'],
    queryFn: getChildren,
  })
  useEffect(() => {
    if (!childrenQuery.isSuccess || teacherFilter.trim() || initializedChildSelection.current) return
    initializedChildSelection.current = true
    setSelectedChildIds(new Set(childrenQuery.data.map((child) => child._id)))
  }, [childrenQuery.data, childrenQuery.isSuccess, teacherFilter])
  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: getTeachers,
    enabled: Boolean(editingChild || findingTeacherFor || teacherFilter || (editingDay && needsTeacher(editingDay.attendanceType))),
  })
  const editingDayPlanQuery = useQuery({
    queryKey: ['attendance-day-plan', month, editingDay?.childId],
    queryFn: () => getPlans(month, editingDay!.childId),
    enabled: Boolean(editingDay?.childId),
  })
  const accountBanksQuery = useQuery({
    queryKey: ['account-banks'],
    queryFn: getAccountBanks,
    enabled: Boolean(receiptGroup),
  })
  const filteredTeachers = useMemo(() => {
    const keyword = teacherSearch.trim().toLocaleLowerCase('vi')
    return (teachersQuery.data || []).filter((teacher) => teacher.active && (!keyword || teacher.name.toLocaleLowerCase('vi').includes(keyword)))
  }, [teacherSearch, teachersQuery.data])
  const selectedTeacherName = (teachersQuery.data || []).find((teacher) => teacher._id === selectedTeacherId)?.name
  const editTeacherName = (teachersQuery.data || []).find((teacher) => teacher._id === editTeacherId)?.name
  const editingDayPlanItems = useMemo(() => {
    if (!editingDay) return []
    return (editingDayPlanQuery.data?.[0]?.days.find((day) => day.date.slice(0, 10) === editingDay.date)?.items || [])
      .filter((item) => item.content.trim())
  }, [editingDay, editingDayPlanQuery.data])
  const companyBank = accountBanksQuery.data?.find((bank) => bank.accountNumber === '1057884906')
  const updateCachedAttendance = (updated: MonthlyAttendance) => {
    queryClient.setQueryData<MonthlyAttendance[]>(['student-history', month, type], (current) => {
      if (!current) return current
      const rowIndex = current.findIndex((attendance) => attendance._id === updated._id)
      if (rowIndex === -1) {
        return updated.month === month && (type === 'ALL' || updated.type === type) ? [...current, updated] : current
      }
      return current.map((attendance, index) => index === rowIndex ? updated : attendance)
    })
  }
  const updateCachedChild = (updated: Child) => {
    queryClient.setQueriesData<MonthlyAttendance[]>({ queryKey: ['student-history'] }, (current) =>
      current?.map((attendance) => {
        const childId = typeof attendance.children === 'string' ? attendance.children : attendance.children._id
        return childId === updated._id ? { ...attendance, children: updated } : attendance
      }),
    )
    queryClient.setQueryData<Child[]>(['children'], (current) =>
      current?.map((child) => child._id === updated._id ? updated : child),
    )
  }
  const finishEditMutation = useMutation({
    mutationFn: async (attendance: MonthlyAttendance) => {
      if (!attendance.note.trim()) {
        await updateAttendanceNote(attendance._id, attendanceDurationPlaceholder(attendance.days, attendance.type))
      }
      return setAttendanceCompleted(attendance._id, true)
    },
    onSuccess: (updated, attendance) => {
      updateCachedAttendance(updated)
      setEditingIds((current) => { const next = new Set(current); next.delete(attendance._id); return next })
      toast.success('Đã lưu lịch sử học')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu lịch sử học'),
  })
  const attendanceNoteMutation = useMutation({
    mutationFn: ({ attendanceId, note }: { attendanceId: string; note: string }) => updateAttendanceNote(attendanceId, note),
    onSuccess: (updated) => {
      updateCachedAttendance(updated)
      toast.success('Đã lưu ghi chú chung')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú chung'),
  })
  const dayMutation = useMutation({
    mutationFn: async ({ attendanceId, childId, date, attendanceType, attended, spendTime, defaultTeacherId, teacherIds, absent, refund, notes, lessonType }: { attendanceId: string; childId: string; date: string; attendanceType: AttendanceType; attended: boolean; spendTime?: number; defaultTeacherId?: string | null; teacherIds?: string[]; absent?: boolean; refund?: number; notes?: string; lessonType?: string }) => {
      const selectedTeacherId = defaultTeacherId || undefined
      if (!attended) {
        const ids = teacherIds?.length ? teacherIds : (selectedTeacherId ? [selectedTeacherId] : [undefined])
        let last = null
        for (const teacherId of ids) {
          last = await createAttendance(childId, date, attendanceType === 'CA_NGAY' ? 0 : spendTime || 1, attendanceType, teacherId)
        }
        if (!last) throw new Error('Không thể tạo buổi học')
        return last
      }
      if (spendTime !== undefined) return updateAttendanceDay(attendanceId, date, spendTime, needsTeacher(attendanceType) ? selectedTeacherId : undefined, absent, refund, notes, lessonType)
      return deleteAttendanceDay(childId, date, attendanceType)
    },
    onSuccess: (updated, variables) => {
      updateCachedAttendance(updated)
      if (variables.defaultTeacherId && !variables.absent && (!variables.attended || variables.spendTime !== undefined)) {
        setSelectedAttendanceTeachers((current) => ({ ...current, [updated._id]: variables.defaultTeacherId as string }))
      }
      setEditingDay(null)
      toast.success('Đã cập nhật ngày học')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật ngày học'),
  })
  const updateChildTeacherMutation = useMutation({
    mutationFn: ({ child, typeCode, teacherId, teacherPrice }: { child: Child; typeCode: ChildTypeCode; teacherId: string | null; teacherPrice: number }) =>
      updateChild(child._id, {
        type: child.type.map((config) => config.type === typeCode
          ? { ...config, teacherPrice, schedules: teacherId ? [{ ...(config.schedules[0] || { scheduleInWeek: [] }), teacherId, teacherName: '', teacherPrice }, ...config.schedules.slice(1)] : config.schedules.slice(1) }
          : config),
      }),
    onSuccess: (updated) => {
      updateCachedChild(updated)
      setFindingTeacherFor(null)
      setTeacherSearch('')
      setSelectedTeacherId('')
      toast.success('Đã cập nhật giáo viên cho trẻ')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật giáo viên'),
  })
  const updateChildMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Child> }) => updateChild(id, data),
    onSuccess: async (updated) => {
      updateCachedChild(updated)
      await queryClient.invalidateQueries({ queryKey: ['children'] })
      await queryClient.refetchQueries({ queryKey: ['student-history', month, type], type: 'active' })
      setEditingChild(null)
      toast.success('Đã cập nhật trẻ và tải lại Lịch sử học')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trẻ'),
  })
  const quickStatusMutation = useMutation({
    mutationFn: async ({ children, status }: { children: Child[]; status: 'NOT_COMPLETED' | 'COMPLETED' | 'SENT' }) => {
      const childIds = new Set(children.map((child) => child._id))
      const rows = (attendanceQuery.data || []).filter((row) => childIds.has(typeof row.children === 'string' ? row.children : row.children._id))
      if (status !== 'SENT' && rows.length === 0) throw new Error('Trẻ chưa có bảng điểm danh trong tháng này')
      const updatedRows = status === 'SENT' ? [] : await Promise.all(rows.map((row) => setAttendanceCompleted(row._id, status === 'COMPLETED')))
      const updatedChildren = await Promise.all(children.map(async (child) => {
        const sentMonths = child.isSend || []
        const nextSentMonths = status === 'SENT'
          ? [...new Set([...sentMonths, month])].sort()
          : sentMonths.filter((item) => item !== month)
        return nextSentMonths.length === sentMonths.length && nextSentMonths.every((item, index) => item === sentMonths[index])
          ? child
          : updateChild(child._id, { isSend: nextSentMonths })
      }))
      return { updatedRows, updatedChildren, status, count: children.length }
    },
    onSuccess: ({ updatedRows, updatedChildren, status, count }) => {
      updatedRows.forEach(updateCachedAttendance)
      updatedChildren.forEach(updateCachedChild)
      toast.success(`${status === 'SENT' ? 'Đã đánh dấu gửi phụ huynh' : status === 'COMPLETED' ? 'Đã hoàn thành điểm danh' : 'Đã chuyển về chưa điểm danh'} cho ${count} trẻ`)
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái'),
  })
  const submitChildUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingChild) return
    const form = new FormData(event.currentTarget)
    const childTypes = readTypeConfigs(form)
    if (childTypes.length === 0) return toast.error('Vui lòng chọn ít nhất một loại học')
    const data: Partial<Child> = {
      name: String(form.get('name') || '').trim(),
      gender: String(form.get('gender') || ''),
      birthDate: String(form.get('birthDate') || '') || null,
      phone: String(form.get('phone') || '').trim(),
      planLink: String(form.get('planLink') || '').trim(),
      status: String(form.get('status') || 'DANG_HOC') as Child['status'],
      offAt: String(form.get('offAt') || '') || null,
      type: childTypes,
      isInvoice: form.get('isInvoice') === 'on',
      invoiceAmount: Math.max(Number(form.get('invoiceAmount')) || 0, 0),
      ages: readChildAges(form),
    }
    updateChildMutation.mutate({ id: editingChild._id, data })
  }
  const teacherOptions = useMemo(() => {
    const teachers = new Map<string, string>()
    for (const teacher of teachersQuery.data || []) teachers.set(teacher._id, teacher.name)
    for (const attendance of attendanceQuery.data || []) {
      const child = typeof attendance.children === 'string' ? null : attendance.children
      for (const config of child?.type || []) {
        for (const schedule of config.schedules) if (schedule.teacherId && schedule.teacherName) teachers.set(schedule.teacherId, schedule.teacherName)
      }
      for (const day of attendance.days) {
        if (day.teacherId && day.teacherName) teachers.set(day.teacherId, day.teacherName)
      }
    }
    return [...teachers].sort((left, right) => left[1].localeCompare(right[1], 'vi'))
  }, [attendanceQuery.data, teachersQuery.data])
  const teacherParam = searchParams.get('teacher')?.trim() || ''
  const filteredTeacherId = useMemo(() => {
    const value = teacherFilter.trim()
    if (!value) return ''
    const isId = teacherOptions.some(([id]) => id === value) || (value === teacherParam && !teacherOptions.some(([, name]) => name === value))
    if (isId) return value
    const selectedName = value.toLocaleLowerCase('vi')
    const paramName = teacherOptions.find(([id]) => id === teacherParam)?.[1]?.trim().toLocaleLowerCase('vi')
    if (teacherParam && paramName === selectedName) return teacherParam
    return teacherOptions.find(([, name]) => name.trim().toLocaleLowerCase('vi') === selectedName)?.[0] || ''
  }, [teacherFilter, teacherOptions, teacherParam])
  useEffect(() => {
    if (!filteredTeacherId) return
    const name = teacherOptions.find(([id]) => id === filteredTeacherId)?.[1]
    if (name && teacherFilter === filteredTeacherId) setTeacherFilter(name)
  }, [filteredTeacherId, teacherFilter, teacherOptions])
  useEffect(() => {
    if (!teacherFilter.trim()) return
    const childIds = new Set<string>()
    for (const attendance of attendanceQuery.data || []) {
      const child = typeof attendance.children === 'string' ? null : attendance.children
      const matches = filteredTeacherId
        ? attendanceTeacherIds(attendance).includes(filteredTeacherId)
        : [...(child?.type || []).flatMap((config) => config.schedules.map((schedule) => schedule.teacherName)), ...attendance.days.map((day) => day.teacherName)]
          .filter(Boolean).join(' ').toLocaleLowerCase('vi')
          .includes(teacherFilter.trim().toLocaleLowerCase('vi'))
      if (matches) childIds.add(typeof attendance.children === 'string' ? attendance.children : attendance.children._id)
    }
    setSelectedChildIds(childIds)
  }, [attendanceQuery.data, filteredTeacherId, teacherFilter])
  const matchingHistoryRows = useMemo(
    () => (attendanceQuery.data || []).filter((attendance) => {
      if (!teacherFilter.trim()) return true
      if (filteredTeacherId) return attendanceTeacherIds(attendance).includes(filteredTeacherId)
      const child = typeof attendance.children === 'string' ? null : attendance.children
      const teacherKeyword = teacherFilter.trim().toLocaleLowerCase('vi')
      const teacherNames = [...(child?.type || []).flatMap((config) => config.schedules.map((schedule) => schedule.teacherName)), ...attendance.days.map((day) => day.teacherName)]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi')
      return teacherNames.includes(teacherKeyword)
    }).sort((left, right) => {
      const leftChild = typeof left.children === 'string' ? null : left.children
      const rightChild = typeof right.children === 'string' ? null : right.children
      const orderDifference = (leftChild?.order || 0) - (rightChild?.order || 0)
      if (orderDifference !== 0) return orderDifference
      const leftId = typeof left.children === 'string' ? left.children : left.children._id
      const rightId = typeof right.children === 'string' ? right.children : right.children._id
      const childOrder = leftId.localeCompare(rightId, 'vi', { numeric: true })
      if (childOrder !== 0) return childOrder
      return left.type === right.type ? 0 : isFullDayType(left.type) ? -1 : 1
    }),
    [attendanceQuery.data, filteredTeacherId, teacherFilter],
  )
  const historyRows = useMemo(
    () => selectedChildIds.size > 0
      ? matchingHistoryRows.filter((row) => selectedChildIds.has(typeof row.children === 'string' ? row.children : row.children._id))
      : [],
    [matchingHistoryRows, selectedChildIds],
  )
  const childTiles = useMemo(() => {
    const teacherKeyword = teacherFilter.trim()
    const childKeyword = childSearch.trim().toLocaleLowerCase('vi')
    const matchingChildIds = teacherKeyword
      ? new Set(matchingHistoryRows.map((row) => typeof row.children === 'string' ? row.children : row.children._id))
      : null
    return [...(childrenQuery.data || [])]
      .filter((child) => !matchingChildIds || matchingChildIds.has(child._id))
      .filter((child) => !childKeyword || child.name.toLocaleLowerCase('vi').includes(childKeyword))
      .sort((left, right) => {
        if (sortChildrenByType) {
          const typeDifference = childTypeText(left).localeCompare(childTypeText(right), 'vi')
          if (typeDifference !== 0) return typeDifference
        }
        return (left.order || 0) - (right.order || 0) || left.name.localeCompare(right.name, 'vi')
      })
      .map((child) => {
        const rows = (attendanceQuery.data || []).filter((row) => (typeof row.children === 'string' ? row.children : row.children._id) === child._id)
        return {
          child,
          isCompleted: rows.length > 0 && rows.every((row) => row.isCompleted),
          isSent: child.isSend.includes(month),
        }
      })
  }, [attendanceQuery.data, childSearch, childrenQuery.data, matchingHistoryRows, month, sortChildrenByType, teacherFilter])
  const quickStatusChildren = childTiles.filter(({ child }) => selectedChildIds.has(child._id)).map(({ child }) => child)
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
    const receiptRows = receiptGroup.rows.filter((row) => row.days.length > 0)
    const totals = receiptRows.reduce((sum, row) => {
      const rowTotal = attendanceTotals(row)
      return { revenue: sum.revenue + rowTotal.revenue, expense: sum.expense + rowTotal.expense }
    }, { revenue: 0, expense: 0 })
    const days = receiptRows.flatMap((row) => row.days.map((day) => ({ ...day, attendanceType: row.type })))
      .sort((left, right) => left.date.localeCompare(right.date))
    const groups = receiptRows.map((row) => {
      const groupDays = row.days.map((day) => ({ ...day, attendanceType: row.type }))
        .sort((left, right) => left.date.localeCompare(right.date))
      return {
        type: row.type,
        label: attendanceTypeLabel(row.type),
        days: groupDays,
        totals: attendanceTotals(row),
        totalHours: groupDays.filter((day) => !isFullDayType(day.attendanceType) && !day.absent)
          .reduce((sum, day) => sum + day.spendTime, 0),
      }
    })
    return {
      child,
      totals,
      days,
      groups,
      totalHours: days.filter((day) => !isFullDayType(day.attendanceType) && !day.absent).reduce((sum, day) => sum + day.spendTime, 0),
      totalRefund: days.reduce((sum, day) => sum + day.refund, 0),
    }
  }, [receiptGroup])
  const remainingBankOptions = (accountBanksQuery.data || []).filter(
    (bank) => bank.accountNumber !== (companyBank?.accountNumber || '1057884906'),
  )
  const isCashPayment = selectedBankId === CASH_PAYMENT
  const remainingBank = remainingBankOptions.find((bank) => bank._id === selectedBankId)
  useEffect(() => {
    if (!receiptGroup) return
    const child = typeof receiptGroup.rows[0]?.children === 'string' ? null : receiptGroup.rows[0]?.children
    if (child?.isInvoice) {
      setSelectedBankId(CASH_PAYMENT)
      return
    }
    const defaultBank = accountBanksQuery.data?.find(
      (bank) => bank.accountNumber !== (companyBank?.accountNumber || '1057884906'),
    )
    setSelectedBankId(defaultBank?._id || CASH_PAYMENT)
  }, [accountBanksQuery.data, companyBank?.accountNumber, receiptGroup])
  const childName = receiptData?.child?.name || ''
  const invoiceAmount = receiptData?.child?.invoiceAmount || 3240000
  const remainingAmount = Math.max((receiptData?.totals.revenue || 0) - (receiptData?.child?.isInvoice ? invoiceAmount : 0), 0)
  const companyQrQuery = useQuery({
    queryKey: ['vietqr', 'company', companyBank?.accountNumber, companyBank?.bankName, invoiceAmount, childName],
    queryFn: () => getVietQrImage({ accountNumber: companyBank?.accountNumber || '1057884906', bankName: companyBank?.bankName || 'Vietcombank', amount: invoiceAmount, description: childName }),
    enabled: Boolean(receiptData?.child?.isInvoice && childName),
  })
  const selectedBankQrQuery = useQuery({
    queryKey: ['vietqr', 'selected', remainingBank?.accountNumber, remainingBank?.bankName, remainingAmount, childName],
    queryFn: () => getVietQrImage({ accountNumber: remainingBank!.accountNumber, bankName: remainingBank!.bankName, amount: remainingAmount, description: childName }),
    enabled: Boolean(receiptData && childName && remainingBank),
  })
  const qrImagesReady = (isCashPayment || selectedBankQrQuery.isSuccess) && (!receiptData?.child?.isInvoice || companyQrQuery.isSuccess)

  const openDayEditor = (attendance: MonthlyAttendance, date: string, item: MonthlyAttendance['days'][number], defaultTeacherId?: string | null) => {
    const value = String(item.spendTime)
    const childId = typeof attendance.children === 'string' ? attendance.children : attendance.children._id
    setEditingDay({ attendanceId: attendance._id, childId, attendanceType: attendance.type, date, day: item, defaultTeacherId })
    setEditSpendTime(value)
    setCustomSpendTime(!DURATION_PRESETS.some((preset) => preset.minutes === durationMinutes(value)))
    setEditTeacherId(item.teacherId || defaultTeacherId || '')
    setEditAbsent(item.absent)
    setEditRefund(String(item.refund || 0))
    setEditNotes(item.notes || '')
    setEditLessonType(item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC'))
    setCustomLessonType(!LESSON_TYPES.some(([type]) => type === (item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC'))))
  }
  const requestAttendanceConfirmation = (attendanceId: string, childNameValue: string) => {
    if (attendanceConfirmResolver.current) return Promise.resolve(false)
    setAttendanceConfirmation({ attendanceId, childName: childNameValue })
    return new Promise<boolean>((resolve) => { attendanceConfirmResolver.current = resolve })
  }
  const closeAttendanceConfirmation = (confirmed: boolean) => {
    const resolve = attendanceConfirmResolver.current
    attendanceConfirmResolver.current = null
    setAttendanceConfirmation(null)
    resolve?.(confirmed)
  }
  const confirmEditingFromCell = async (attendance: MonthlyAttendance, childNameValue: string) => {
    if (editingIds.has(attendance._id)) return true
    if (!await requestAttendanceConfirmation(attendance._id, childNameValue)) return false
    try {
      if (attendance.isCompleted) {
        const updated = await setAttendanceCompleted(attendance._id, false)
        updateCachedAttendance(updated)
      }
      setEditingIds((current) => new Set(current).add(attendance._id))
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể mở chỉnh sửa')
      return false
    }
  }
  const copyReceiptImage = async () => {
    if (!receiptRef.current) return
    try {
      setCopyingReceipt(true)
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const blob = await toBlob(receiptRef.current, { backgroundColor: '#ffffff', width: 700, pixelRatio: 2, cacheBust: true })
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
          description={selectedChildIds.size > 0 ? `${historyRows.length} bảng điểm danh của ${selectedChildIds.size} học sinh đã chọn` : 'Chọn học sinh để xem lịch sử học'}
          action={<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {isTeacherSession ? <select aria-label="Tháng điểm danh" value={month} onChange={(event) => setMonth(event.target.value)} className="h-9 min-w-36 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary">
              {teacherMonthOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : <><select aria-label="Tháng" value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-9 min-w-24 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary">
              {MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}
            </select>
            <select aria-label="Năm" value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-9 min-w-24 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary">
              {YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}
            </select>
            <input aria-label="Giáo viên" type="search" list="history-teacher-options" value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} placeholder="Tìm giáo viên..." className="h-9 min-w-40 flex-1 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary sm:w-44 sm:flex-none" /><datalist id="history-teacher-options">{teacherOptions.map(([id, name]) => <option key={id} value={name} />)}</datalist></>}
          </div>}
        />

        {childrenQuery.isSuccess && <div className="grid gap-3 border-b border-border p-4 sm:px-6">
          {!isTeacherSession && <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-1 flex-wrap items-center gap-2"><strong className="text-sm">Chọn học sinh</strong><span className="text-xs text-muted">Đã chọn {selectedChildIds.size}</span>{!isChildPickerCollapsed && <><label className="relative min-w-44 flex-1 sm:max-w-64"><span className="sr-only">Tìm tên trẻ</span><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={childSearch} onChange={(event) => setChildSearch(event.target.value)} placeholder="Tìm tên trẻ..." className="h-8 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-xs font-medium outline-none focus:border-primary" /></label><Button type="button" size="sm" variant="secondary" onClick={() => setSelectedChildIds((current) => { const next = new Set(current); const allVisibleSelected = childTiles.length > 0 && childTiles.every(({ child }) => next.has(child._id)); childTiles.forEach(({ child }) => { if (allVisibleSelected) next.delete(child._id); else next.add(child._id) }); return next })}>{childTiles.length > 0 && childTiles.every(({ child }) => selectedChildIds.has(child._id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</Button></>}</div>
            <div className="flex items-center gap-2"><Button type="button" size="sm" variant={sortChildrenByType ? 'primary' : 'secondary'} onClick={() => setSortChildrenByType((value) => !value)}><ArrowUpDown size={14} />{sortChildrenByType ? 'Đang xếp theo loại' : 'Sắp xếp theo loại'}</Button><Button type="button" size="sm" variant="secondary" onClick={() => setIsChildPickerCollapsed((value) => !value)}>{isChildPickerCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}{isChildPickerCollapsed ? 'Mở rộng' : 'Thu gọn'}</Button></div>
          </div>}
          {!isChildPickerCollapsed && <>
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs font-bold text-text-main">
              <span className="inline-flex items-center gap-1.5 text-slate-900 dark:text-slate-100"><i className="h-3.5 w-3.5 rounded border border-red-400 bg-white dark:bg-surface" />Chưa điểm danh</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border border-emerald-400 bg-emerald-100" />Đã điểm danh</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-3.5 rounded border border-blue-400 bg-blue-100" />Đã gửi PH</span>
            </div>
          <div className="grid min-h-12 grid-cols-3 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 p-2 sm:flex sm:flex-wrap dark:border-blue-500/40 dark:bg-blue-500/10">
            {quickStatusChildren.length > 0 ? <><span className="col-span-3 min-w-0 truncate text-xs font-semibold text-text-main sm:mr-auto">Cập nhật {quickStatusChildren.length} trẻ đã chọn</span>
              <Button type="button" size="sm" variant="secondary" disabled={quickStatusMutation.isPending} className="h-auto min-h-8 min-w-0 whitespace-normal border-red-400 bg-white px-1 text-center text-[10px] leading-tight text-slate-900 hover:bg-red-50 sm:w-auto sm:px-3 sm:text-sm dark:border-red-500/60 dark:bg-surface dark:text-slate-100 dark:hover:bg-red-500/10" onClick={() => quickStatusMutation.mutate({ children: quickStatusChildren, status: 'NOT_COMPLETED' })}><XCircle size={13} className="shrink-0" />Chưa điểm danh</Button>
              <Button type="button" size="sm" variant="secondary" disabled={quickStatusMutation.isPending} className="h-auto min-h-8 min-w-0 whitespace-normal border-emerald-400 bg-emerald-100 px-1 text-center text-[10px] leading-tight text-emerald-800 sm:w-auto sm:px-3 sm:text-sm" onClick={() => quickStatusMutation.mutate({ children: quickStatusChildren, status: 'COMPLETED' })}><CheckCircle2 size={13} className="shrink-0" />Đã điểm danh</Button>
              {!isTeacherSession && <Button type="button" size="sm" variant="secondary" disabled={quickStatusMutation.isPending} className="h-auto min-h-8 min-w-0 whitespace-normal border-blue-400 bg-blue-100 px-1 text-center text-[10px] leading-tight text-blue-800 sm:w-auto sm:px-3 sm:text-sm" onClick={() => quickStatusMutation.mutate({ children: quickStatusChildren, status: 'SENT' })}><Send size={13} className="shrink-0" />Đã gửi PH</Button>}</> : <span className="col-span-3 text-xs text-muted">Chọn một hoặc nhiều trẻ để đổi trạng thái nhanh.</span>}
          </div>
          <div className="grid max-h-[170px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-slate-100/80 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 dark:border-slate-700 dark:bg-slate-800/60">
            {childTiles.map(({ child, isCompleted, isSent }) => <button
              key={child._id}
              type="button"
              onClick={() => setSelectedChildIds((current) => { const next = new Set(current); if (next.has(child._id)) next.delete(child._id); else next.add(child._id); return next })}
              className={`relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg border px-1.5 pl-6 text-center font-normal leading-tight transition hover:-translate-y-0.5 hover:shadow-sm ${isSent ? 'border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-500/60 dark:bg-blue-500/20 dark:text-blue-200' : isCompleted ? 'border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-500/20 dark:text-emerald-200' : 'border-red-400 bg-white text-slate-900 dark:border-red-500/60 dark:bg-surface dark:text-slate-100'} ${selectedChildIds.has(child._id) ? 'ring-2 ring-violet-500 ring-offset-1 dark:ring-offset-surface' : ''}`}
            >{isSent ? <Send size={13} className="absolute left-1.5 top-1.5 text-blue-600" aria-label="Đã gửi phụ huynh" /> : isCompleted ? <CheckCircle2 size={13} className="absolute left-1.5 top-1.5 text-emerald-600" aria-label="Đã điểm danh" /> : <XCircle size={13} className="absolute left-1.5 top-1.5 text-red-600" aria-label="Chưa điểm danh" />}<span className="w-full truncate text-xs">{child.name}</span><span className="mt-0.5 w-full truncate text-[9px] font-semibold opacity-70">{childTypeText(child)}</span></button>)}
          </div>
          {childTiles.length === 0 && <p className="m-0 py-3 text-center text-sm text-muted">Không tìm thấy học sinh.</p>}
          </>}
        </div>}

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
        {attendanceQuery.isSuccess && selectedChildIds.size === 0 && (
          <div className="grid min-h-40 place-items-center p-6 text-center text-sm text-muted">Chọn tên học sinh phía trên để xem lịch sử học.</div>
        )}
        {attendanceQuery.isSuccess && selectedChildIds.size > 0 && historyRows.length === 0 && (
          <div className="grid min-h-64 place-items-center text-sm text-muted">Chưa có dữ liệu học trong tháng này.</div>
        )}

        {attendanceQuery.isSuccess && historyRows.length > 0 && viewMode === 'table' && (
          <Table className="w-max min-w-full border-separate border-spacing-0" containerClassName="max-h-[calc(100vh-260px)] max-w-full overflow-auto overscroll-contain">
            <TableHeader className="sticky top-0 z-20 bg-surface-muted shadow-sm">
              <TableRow>
                <TableHead className="top-0 z-30 hidden w-64 min-w-64 max-w-64 border-r border-border bg-surface-muted shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)] sm:sticky sm:left-0 sm:table-cell">Trẻ</TableHead>
                <TableHead className="w-32 min-w-32 text-center sm:w-40 sm:min-w-40"><span className="sm:hidden">Trẻ / </span>Loại học</TableHead>
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
                const childTotals = childRows.reduce((total, row) => { const rowTotal = attendanceTotals(row); return { revenue: total.revenue + rowTotal.revenue, expense: total.expense + rowTotal.expense } }, { revenue: 0, expense: 0 })
                const boardingRow = childRows.find((row) => row.type === 'CA_NGAY')
                const sessionRow = childRows.find((row) => row.type === 'THEO_BUOI')
                const latestDay = (items: typeof attendance.days) => items.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, items[0])
                const boardingSnapshot = latestDay(boardingRow?.days || [])
                const sessionSnapshot = latestDay(sessionRow?.days || [])
                const attendanceByDay = groupDaysByDate(attendance.days)
                const rowTotals = attendanceTotals(attendance)
                const pricingConfig = configForAttendance(child as Child | null, attendance.type, sessionSnapshot?.lessonType)
                return (
                  <TableRow key={attendance._id} className="group">
                    {showChild && <TableCell rowSpan={childRowCount} className="z-10 hidden w-64 min-w-64 max-w-64 border-r border-border bg-surface align-top shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)] sm:sticky sm:left-0 sm:table-cell">
                      <div className="grid gap-2"><div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10">
                        <div className="grid shrink-0 justify-items-center gap-0.5"><img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-11 w-11 rounded-xl bg-surface-muted object-cover" /><span className="max-w-14 truncate text-[8px] leading-none text-muted" title={`ID: ${child?._id || childId}`}>ID: {child?._id || childId}</span></div>
                        <div className="min-w-0">
                          <strong className="block max-w-40 whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${attendance.children}`}</strong>
                          <span className="mt-0.5 block text-[10px] font-semibold text-blue-600 dark:text-blue-300">{childTypeText(child)}</span>
                          <span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span>
                        </div>
                      </div><Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button><Button type="button" size="sm" variant="secondary" onClick={() => openChildPlan(childId)}><BookOpenText size={13} />Kế hoạch</Button><Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows: childRows })}><FileImage size={13} />Xuất phiếu</Button><div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border"><span className="grid gap-0.5 bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Tổng thu<strong className="whitespace-nowrap text-[11px]">{formatMoney(childTotals.revenue)}</strong></span><span className="grid gap-0.5 bg-red-50 px-2 py-1.5 text-[10px] text-red-700 dark:bg-red-500/15 dark:text-red-300">Tổng chi<strong className="whitespace-nowrap text-[11px]">{formatMoney(childTotals.expense)}</strong></span></div><AttendanceStatusList rows={childRows} /></div>
                    </TableCell>}
                    <TableCell className="text-center">
                      <div className="mb-1 max-w-32 rounded-lg border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs leading-snug text-text-main dark:border-blue-500/30 dark:bg-blue-500/10 sm:hidden"><strong className="block whitespace-normal">{child?.name || `Trẻ #${attendance.children}`}</strong><span className="mt-0.5 block text-[9px] font-semibold text-blue-600 dark:text-blue-300">{childTypeText(child)}</span></div>
                      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${isFullDayType(attendance.type) ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendanceTypeLabel(attendance.type)}</span>
                      {needsTeacher(attendance.type) && <div className="mx-auto mt-1 grid max-w-40 gap-0.5 text-[10px] text-muted"><span>GV: <strong className="text-blue-600 dark:text-blue-400">{attendanceTeacherNames(attendance.days, pricingConfig?.schedules.map((schedule) => schedule.teacherName).filter(Boolean).join(', '))}</strong></span>{!isTeacherSession && <span className="contents">{child && <Button type="button" size="sm" variant="secondary" className={`mx-auto my-1 ${FIND_TEACHER_BUTTON_CLASS}`} onClick={() => { setFindingTeacherFor({ child: child as Child, childName: child.name || `Trẻ #${childId}`, typeCode: pricingConfig?.type || lessonConfigType(sessionSnapshot?.lessonType), teacherId: pricingConfig?.teacherId }); setTeacherSearch(''); setTeacherHourlySalary(String(pricingConfig?.teacherPrice || 130000)); setSelectedTeacherId(pricingConfig?.teacherId || '') }}><Search size={12} />Tìm GV</Button>}<TeacherSalaryLines days={attendance.days} selectedTeacherId={selectedAttendanceTeachers[attendance._id]} onSelect={(teacherId) => setSelectedAttendanceTeachers((current) => ({ ...current, [attendance._id]: teacherId }))} /><span>Học phí: <strong className="text-emerald-600 dark:text-emerald-300">{formatMoney(sessionSnapshot?.tuitionFee || pricingConfig?.price || 0)}</strong></span></span>}</div>}
                      {!isTeacherSession && <><span className="mx-auto mt-1 block whitespace-nowrap text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">Thu: {formatMoney(rowTotals.revenue)}</span><span className="mx-auto block whitespace-nowrap text-[10px] font-semibold text-red-600 dark:text-red-300">Chi: {formatMoney(rowTotals.expense)}</span></>}
                      {attendance.isCompleted && <span className="mx-auto mt-1 flex w-fit items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={10} />Hoàn tất</span>}
                      <Button type="button" size="sm" variant="secondary" className="complete-attention mx-auto mt-2" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button>
                    </TableCell>
                    {days.map((day) => {
                      const items = attendanceByDay.get(day) || []
                      const item = items.find((session) => session.teacherId === selectedAttendanceTeachers[attendance._id]) || items[0]
                      const hasAbsent = items.some((session) => session.absent)
                      const hasPresent = items.some((session) => !session.absent)
                      return (
                        <TableCell key={day} className="p-1 text-center">
                          <button type="button" disabled={dayMutation.isPending} onClick={async () => {
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            if (!await confirmEditingFromCell(attendance, child?.name || `Trẻ #${childId}`)) return
                            const scheduledIds = scheduledTeacherIds(pricingConfig, date)
                            const fallbackTeacherId = pricingConfig?.teacherId || pricingConfig?.schedules.find((schedule) => schedule.teacherId)?.teacherId || ''
                            const teacherIds = filteredTeacherId ? [filteredTeacherId] : scheduledIds.length ? scheduledIds : fallbackTeacherId ? [fallbackTeacherId] : []
                            if (item) {
                              openDayEditor(attendance, date, item, item.teacherId || teacherIds[0])
                              return
                            }
                            const scheduledTeacherId = selectedAttendanceTeachers[attendance._id] || filteredTeacherId || teacherIds[0] || fallbackTeacherId
                            if (needsTeacher(attendance.type) && !scheduledTeacherId) return toast.error('Trẻ chưa có giáo viên trong lịch ngày này')
                            dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: false, defaultTeacherId: scheduledTeacherId, teacherIds })
                          }} className={`mx-auto grid min-h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-1 py-1 text-[10px] font-bold transition ${items.length ? hasAbsent && !hasPresent ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-muted/40'} ${editingIds.has(attendance._id) ? 'ring-1 ring-primary/30 hover:bg-primary/10' : 'hover:bg-primary/5 hover:ring-1 hover:ring-primary/20'} disabled:opacity-70`} title={editingIds.has(attendance._id) ? items.length ? 'Bấm để sửa buổi học' : 'Bấm để thêm ngày học' : `Bấm để điểm danh bé ${child?.name || childId}`}>{items.length ? isFullDayType(attendance.type) ? <span><span className="block">{hasPresent ? <Check size={15} /> : 'Nghỉ'}</span>{sessionTeacherNames(items) && <span className="mt-0.5 block max-w-20 font-medium">{sessionTeacherNames(items)}</span>}{items.some((session) => session.notes) && <span className="mt-0.5 block max-w-24 truncate text-[8px] font-medium text-violet-600 dark:text-violet-300">* {items.map((session) => session.notes).filter(Boolean).join(', ')}</span>}{items.some((session) => session.refund > 0) && <span className="mt-0.5 block text-red-600">Hoàn {formatMoney(items.reduce((sum, session) => sum + session.refund, 0))}</span>}</span> : <span>{items.map((session) => <span key={`${session.date}-${session.teacherId || session.teacherName}`} className="mt-0.5 block"><span className="block">{session.absent ? 'Nghỉ' : `${session.lessonType || 'HỌC'} · ${formatDuration(session.spendTime)}`}</span>{!session.absent && session.teacherName && <span className="block max-w-20 truncate font-medium">{session.teacherName}</span>}{session.notes && <span className="block max-w-24 truncate text-[8px] font-medium text-violet-600 dark:text-violet-300">* {session.notes}</span>}{session.refund > 0 && <span className="block text-red-600">Hoàn {formatMoney(session.refund)}</span>}</span>)}</span> : '—'}</button>
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
          <div className="grid divide-y-[3px] divide-blue-300 dark:divide-blue-500/50">
            {historyGroups.map(({ childId, rows }) => {
              const child = typeof rows[0].children === 'string' ? null : rows[0].children
              const childTotals = rows.reduce((total, row) => { const rowTotal = attendanceTotals(row); return { revenue: total.revenue + rowTotal.revenue, expense: total.expense + rowTotal.expense } }, { revenue: 0, expense: 0 })
              const sessionRow = rows.find((row) => row.type === 'THEO_BUOI')
              const boardingRow = rows.find((row) => row.type === 'CA_NGAY')
              const sessionSnapshot = sessionRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, sessionRow.days[0])
              const boardingSnapshot = boardingRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, boardingRow.days[0])
              return <div key={childId} className="min-w-0 overflow-x-auto overscroll-x-contain">
                <div className="grid min-w-[420px] grid-cols-1 sm:min-w-[700px] sm:grid-cols-[12rem_minmax(490px,1fr)]">
                  <div className="left-0 z-10 hidden border-r border-border bg-surface-muted p-3 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)] sm:sticky sm:block">
                    <div className="sticky top-3 grid gap-2"><div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <div className="grid shrink-0 justify-items-center gap-0.5"><img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-10 w-10 rounded-lg bg-surface-muted object-cover" /><span className="max-w-14 truncate text-[8px] leading-none text-muted" title={`ID: ${child?._id || childId}`}>ID: {child?._id || childId}</span></div>
                      <div className="min-w-0"><strong className="block whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${childId}`}</strong><span className="mt-0.5 block text-[10px] font-semibold text-blue-600 dark:text-blue-300">{childTypeText(child)}</span><span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span></div></div>
                      {!isTeacherSession && <><Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => openChildPlan(childId)}><BookOpenText size={13} />Kế hoạch</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows })}><FileImage size={13} />Xuất phiếu</Button>
                      <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border"><span className="grid gap-0.5 bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Tổng thu<strong className="whitespace-nowrap text-[11px]">{formatMoney(childTotals.revenue)}</strong></span><span className="grid gap-0.5 bg-red-50 px-2 py-1.5 text-[10px] text-red-700 dark:bg-red-500/15 dark:text-red-300">Tổng chi<strong className="whitespace-nowrap text-[11px]">{formatMoney(childTotals.expense)}</strong></span></div></>}
                      <AttendanceStatusList rows={rows} />
                    </div>
                  </div>
                  <div className="grid gap-3 p-3">
                    <div className="grid gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10 sm:hidden">
                      <div className="min-w-0"><strong className="block truncate text-sm">{child?.name || `Trẻ #${childId}`}</strong><span className="mt-0.5 block text-[10px] font-semibold text-blue-600 dark:text-blue-300">{childTypeText(child)}</span></div>
                      <div className="grid grid-cols-2 items-start gap-2">
                        {!isTeacherSession && <div className="grid gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => openChildPlan(childId)}><BookOpenText size={13} />Kế hoạch</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows })}><FileImage size={13} />Xuất phiếu</Button>
                        </div>}
                        <div className="grid gap-2">
                          <AttendanceStatusList rows={rows} />
                        </div>
                      </div>
                      {!isTeacherSession && <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-lg border border-border">
                        <span className="inline-flex min-w-0 items-center justify-between gap-1 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><span>Tổng thu</span><strong className="whitespace-nowrap">{formatMoney(childTotals.revenue)}</strong></span>
                        <span className="inline-flex min-w-0 items-center justify-between gap-1 bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-500/15 dark:text-red-300"><span>Tổng chi</span><strong className="whitespace-nowrap">{formatMoney(childTotals.expense)}</strong></span>
                      </div>}
                    </div>
                    {rows.map((attendance) => {
                      const rowTotals = attendanceTotals(attendance)
                      const attendanceByDay = groupDaysByDate(attendance.days)
                      const latestSnapshot = attendance.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, attendance.days[0])
                      const pricingConfig = configForAttendance(child as Child | null, attendance.type, latestSnapshot?.lessonType)
                      return <section key={attendance._id} className="relative grid gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                        {attendanceConfirmation?.attendanceId === attendance._id && <div className="absolute right-2 top-2 z-30 grid w-[calc(100%-1rem)] max-w-sm gap-3 rounded-xl border border-blue-300 bg-surface p-3 text-sm shadow-xl dark:border-blue-500/50">
                          <div><strong className="block text-text-main">Xác nhận điểm danh</strong><span className="mt-1 block text-muted">Bạn muốn điểm danh bé <strong className="text-text-main">“{attendanceConfirmation.childName}”</strong> không?</span></div>
                          <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => closeAttendanceConfirmation(false)}>Hủy</Button><Button type="button" size="sm" onClick={() => closeAttendanceConfirmation(true)}><CheckCircle2 size={14} />Xác nhận</Button></div>
                        </div>}
                        <div className="flex items-center justify-center gap-2 py-1 text-center text-[11px] font-bold sm:hidden">
                          <span className={`rounded-full border px-2.5 py-1 ${isFullDayType(attendance.type) ? 'border-blue-300 text-blue-700 dark:border-blue-500/50 dark:text-blue-300' : 'border-purple-300 text-purple-700 dark:border-purple-500/50 dark:text-purple-300'}`}>{attendanceTypeLabel(attendance.type)}</span>
                          <span className="text-muted">·</span>
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap ${attendance.isCompleted ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{attendance.isCompleted ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{attendance.isCompleted ? 'Hoàn thành điểm danh' : 'Chưa điểm danh'}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="grid gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                            <span className={`hidden w-fit shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex ${isFullDayType(attendance.type) ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendanceTypeLabel(attendance.type)}</span>
                            {!isTeacherSession && <span className="hidden flex-wrap items-center gap-x-3 text-xs font-semibold sm:flex"><span className="text-emerald-600">Thu: {formatMoney(rowTotals.revenue)}</span><span className="text-red-600">Chi: {formatMoney(rowTotals.expense)}</span></span>}
                            <span className={`hidden w-fit items-center gap-1 text-xs font-bold sm:inline-flex ${attendance.isCompleted ? 'text-emerald-600' : 'text-red-600'}`}>{attendance.isCompleted ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{attendance.isCompleted ? 'Đã hoàn thành' : 'Chưa điểm danh'}</span>
                          </div>
                          <div className="hidden sm:block"><Button type="button" size="sm" variant="secondary" className="complete-attention h-7 px-2 text-sm" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button></div>
                        </div>
                        {needsTeacher(attendance.type) && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-purple-50/70 px-2.5 py-2 text-xs dark:bg-purple-500/10"><span>GV: <strong className="text-blue-600 dark:text-blue-400">{attendanceTeacherNames(attendance.days, pricingConfig?.schedules.map((schedule) => schedule.teacherName).filter(Boolean).join(', '))}</strong></span>{!isTeacherSession && <span className="contents">{child && <Button type="button" size="sm" variant="secondary" className={FIND_TEACHER_BUTTON_CLASS} onClick={() => { setFindingTeacherFor({ child: child as Child, childName: child.name || `Trẻ #${childId}`, typeCode: pricingConfig?.type || lessonConfigType(latestSnapshot?.lessonType), teacherId: pricingConfig?.teacherId }); setTeacherSearch(''); setTeacherHourlySalary(String(pricingConfig?.teacherPrice || 130000)); setSelectedTeacherId(pricingConfig?.teacherId || '') }}><Search size={12} />Tìm GV</Button>}<TeacherSalaryLines days={attendance.days} selectedTeacherId={selectedAttendanceTeachers[attendance._id]} onSelect={(teacherId) => setSelectedAttendanceTeachers((current) => ({ ...current, [attendance._id]: teacherId }))} /><span>Học phí: <strong className="text-emerald-600 dark:text-emerald-300">{formatMoney(latestSnapshot?.tuitionFee || pricingConfig?.price || 0)}</strong></span></span>}</div>}
                        <div className="flex justify-end sm:hidden"><Button type="button" size="sm" variant="secondary" className="complete-attention w-full" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button></div>
                        <div className="grid min-w-0 grid-cols-7 gap-0.5 sm:gap-1">{CALENDAR_WEEKDAYS.map((weekday, weekdayIndex) => <div key={weekday} className={`min-w-0 border-b border-r border-border px-0.5 py-1.5 text-center text-[11px] font-bold text-muted last:border-r-0 sm:px-1 sm:text-[13px] lg:text-sm ${weekdayIndex >= 5 ? 'bg-slate-200/80 dark:bg-slate-700/70' : 'bg-amber-100/90 dark:bg-amber-500/20'}`}>{weekday}</div>)}
                          {calendarDays.map((day, index) => {
                            const isWeekend = index % 7 >= 5
                            if (!day) return <div key={`empty-${index}`} className={isWeekend ? 'min-h-16 rounded-md bg-slate-100 dark:bg-slate-800/70 sm:min-h-20 lg:min-h-16' : 'min-h-16 sm:min-h-20 lg:min-h-16'} />
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            const items = attendanceByDay.get(day) || []
                            const item = items.find((session) => session.teacherId === selectedAttendanceTeachers[attendance._id]) || items[0]
                            const hasAbsent = items.some((session) => session.absent)
                            const hasPresent = items.some((session) => !session.absent)
                            return <button key={date} type="button" disabled={dayMutation.isPending} onClick={async () => {
                              if (!await confirmEditingFromCell(attendance, child?.name || `Trẻ #${childId}`)) return
                              const scheduledIds = scheduledTeacherIds(pricingConfig, date)
                              const fallbackTeacherId = pricingConfig?.teacherId || pricingConfig?.schedules.find((schedule) => schedule.teacherId)?.teacherId || ''
                              const teacherIds = filteredTeacherId ? [filteredTeacherId] : scheduledIds.length ? scheduledIds : fallbackTeacherId ? [fallbackTeacherId] : []
                              const scheduledTeacherId = selectedAttendanceTeachers[attendance._id] || filteredTeacherId || item?.teacherId || teacherIds[0] || fallbackTeacherId
                              if (item) return openDayEditor(attendance, date, item, scheduledTeacherId)
                              if (needsTeacher(attendance.type) && !scheduledTeacherId) return toast.error('Trẻ chưa có giáo viên trong lịch ngày này')
                              dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: false, defaultTeacherId: scheduledTeacherId, teacherIds })
                            }} className={`relative flex min-w-0 cursor-pointer flex-col rounded-md border p-1 pt-5 text-left transition sm:p-1.5 sm:pt-6 lg:pt-6 ${items.length > 1 ? 'min-h-24 sm:min-h-28 lg:min-h-24' : 'min-h-16 sm:min-h-20 lg:min-h-16'} ${items.length ? hasAbsent && !hasPresent ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-surface'} ${isWeekend ? '!bg-slate-100 dark:!bg-slate-800/80' : ''} hover:border-primary/50 hover:ring-1 hover:ring-primary/20 disabled:opacity-80`} title={editingIds.has(attendance._id) ? items.length ? 'Bấm để chỉnh sửa' : 'Bấm để điểm danh' : `Bấm để điểm danh bé ${child?.name || childId}`}>
                              <span className="absolute left-1 top-1 text-sm font-bold sm:left-1.5 sm:text-base lg:text-lg">{day}</span>{items.length > 0 && <span className="mt-auto block min-w-0 text-[10px] font-semibold leading-snug sm:text-xs lg:text-sm">{items.map((session) => <span key={`${session.date}-${session.teacherId || session.teacherName}`} className="block"><span className="block">{session.absent ? 'Nghỉ' : isFullDayType(attendance.type) ? 'Học' : `${session.lessonType || 'HỌC'} · ${formatDuration(session.spendTime)}`}</span>{!session.absent && session.teacherName && <span className="block truncate opacity-80">{session.teacherName}</span>}{session.notes && <span className="block truncate text-[8px] font-medium text-violet-600 dark:text-violet-300 sm:text-[9px]" title={session.notes}>* {session.notes}</span>}{session.refund > 0 && <span className="block truncate text-red-600">Hoàn {formatMoney(session.refund)}</span>}</span>)}</span>}
                            </button>
                          })}
                        </div>
                        <label className="grid gap-1.5 rounded-lg border border-violet-200 bg-violet-50/60 p-2 text-xs font-semibold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                          Ghi chú chung cho cả lịch học
                          <textarea key={`${attendance._id}-${attendance.note}`} defaultValue={attendance.note} rows={2} disabled={attendanceNoteMutation.isPending} onBlur={(event) => { const note = event.currentTarget.value.trim(); if (note !== attendance.note) attendanceNoteMutation.mutate({ attendanceId: attendance._id, note }) }} placeholder={attendanceDurationPlaceholder(attendance.days, attendance.type)} className="min-h-14 resize-y rounded-lg border border-violet-200 bg-surface px-3 py-2 text-sm font-normal text-text-main outline-none focus:border-violet-500 dark:border-violet-500/30" />
                        </label>
                      </section>
                    })}
                  </div>
                </div>
              </div>
            })}
          </div>
        )}
      </Card>
      <Modal open={Boolean(attendanceConfirmation) && viewMode === 'table'} onClose={() => closeAttendanceConfirmation(false)} title="Xác nhận điểm danh" description={attendanceConfirmation?.childName} className="max-w-md">
        <div className="grid gap-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
            Bạn muốn điểm danh bé <strong>“{attendanceConfirmation?.childName}”</strong> không?
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:justify-end">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => closeAttendanceConfirmation(false)}>Hủy</Button>
            <Button type="button" className="w-full sm:w-auto" onClick={() => closeAttendanceConfirmation(true)}><CheckCircle2 size={16} />Xác nhận điểm danh</Button>
          </div>
        </div>
      </Modal>
      <Modal open={Boolean(editingChild)} onClose={() => !updateChildMutation.isPending && setEditingChild(null)} title="Cập nhật Trẻ" description={editingChild?.name} className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-5xl overflow-y-auto">
        {editingChild && <form onSubmit={submitChildUpdate} className="grid grid-cols-1 gap-5">
          <section className="col-span-full grid gap-4 rounded-xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
            <div className="border-b border-border pb-3 sm:col-span-2 lg:col-span-3"><strong className="text-base">Thông tin cơ bản</strong><span className="mt-0.5 block text-xs text-muted">Thông tin nhận diện và trạng thái học của trẻ.</span></div>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Họ và tên<input name="name" defaultValue={editingChild.name} required className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Giới tính<select name="gender" defaultValue={editingChild.gender} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary"><option value="male">Nam</option><option value="female">Nữ</option></select></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Ngày sinh<input name="birthDate" type="date" defaultValue={formatDateInput(editingChild.birthDate)} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Số điện thoại<input name="phone" defaultValue={editingChild.phone} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Trạng thái<select name="status" defaultValue={editingChild.status} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary"><option value="DANG_HOC">Đang học</option><option value="NGHI_HOC">Đã nghỉ</option></select></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold">Ngày nghỉ học<input name="offAt" type="date" defaultValue={formatDateInput(editingChild.offAt)} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid min-w-0 content-start gap-1.5 text-sm font-semibold sm:col-span-2 lg:col-span-3">Link kế hoạch<input name="planLink" type="url" defaultValue={editingChild.planLink} placeholder="https://..." className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
          </section>
          <section className="col-span-full grid gap-4 rounded-2xl border-2 border-blue-300 bg-blue-50/60 p-3 shadow-sm shadow-blue-500/10 dark:border-blue-500/40 dark:bg-blue-500/10 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-blue-200 pb-3 dark:border-blue-500/30"><div><strong className="text-base text-blue-800 dark:text-blue-200">Loại học và học phí</strong><span className="mt-0.5 block text-xs text-blue-700/70 dark:text-blue-200/70">Chọn loại học, nhập học phí và phân lịch riêng cho từng giáo viên.</span></div><span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Thiết lập học</span></div>
            <ChildTypeEditor initial={editingChild.type} teachers={teachersQuery.data || []} showTitle={false} />
          </section>
          <div className="col-span-full"><ChildAgeEditor initial={editingChild.ages} /></div>
          <section className="col-span-full grid items-end gap-4 rounded-xl border border-border bg-surface-muted/50 p-3 sm:grid-cols-2 sm:p-4">
            <div className="border-b border-border pb-3 sm:col-span-2"><strong className="text-base">Hóa đơn và thanh toán</strong><span className="mt-0.5 block text-xs text-muted">Thiết lập thông tin xuất hóa đơn của trẻ.</span></div>
            <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Số tiền hóa đơn<input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={editingChild.invoiceAmount} className="h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="flex h-10 items-center gap-3 rounded-xl border border-border bg-app-background px-3 text-sm font-semibold"><input name="isInvoice" type="checkbox" defaultChecked={editingChild.isInvoice} className="h-4 w-4 accent-primary" />Xuất hóa đơn</label>
          </section>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:justify-end"><Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={updateChildMutation.isPending} onClick={() => setEditingChild(null)}>Hủy</Button><Button type="submit" className="w-full sm:w-auto" disabled={updateChildMutation.isPending}>{updateChildMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div>
        </form>}
      </Modal>
      <Modal open={Boolean(findingTeacherFor)} onClose={() => !updateChildTeacherMutation.isPending && setFindingTeacherFor(null)} title="Chọn giáo viên" description={findingTeacherFor?.childName} className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
        {findingTeacherFor && <div className="grid gap-4">
          <div className={`flex items-center gap-3 rounded-2xl border p-3 ${selectedTeacherName ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:border-blue-500/40 dark:from-blue-500/15 dark:to-indigo-500/10' : 'border-dashed border-slate-300 bg-surface-muted/50'}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold ${selectedTeacherName ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>{selectedTeacherName?.charAt(0).toLocaleUpperCase('vi') || '?'}</span>
            <div className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Giáo viên đang chọn</span><strong className={`block truncate text-base ${selectedTeacherName ? 'text-blue-800 dark:text-blue-200' : 'text-muted'}`}>{selectedTeacherName || 'Chưa chọn giáo viên'}</strong></div>
            {selectedTeacherId && <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />}
          </div>

          <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted/40 p-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Tìm theo tên giáo viên<span className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" autoFocus value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} placeholder="Nhập tên giáo viên..." className="h-11 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm font-medium text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></span></label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Lương giáo viên/giờ<span className="relative"><input type="number" min="0" step="1000" value={teacherHourlySalary} onChange={(event) => setTeacherHourlySalary(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface px-3 pr-7 text-sm font-bold text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">đ</span></span></label>
          </div>

          <div className="flex items-center justify-between gap-2"><strong className="text-sm">Danh sách giáo viên</strong><span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-bold text-muted">{filteredTeachers.length} kết quả</span></div>
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
            <button type="button" disabled={updateChildTeacherMutation.isPending} onClick={() => setSelectedTeacherId('')} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm ${!selectedTeacherId ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-surface'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-lg text-slate-500 dark:bg-slate-800">—</span><span><strong className="block text-sm">Chưa chọn giáo viên</strong><span className="text-[11px] text-muted">Bỏ phân công hiện tại</span></span></button>
            {filteredTeachers.map((teacher) => <button key={teacher._id} type="button" disabled={updateChildTeacherMutation.isPending} onClick={() => setSelectedTeacherId(teacher._id)} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm ${selectedTeacherId === teacher._id ? 'border-primary bg-primary/10 ring-1 ring-primary/20' : 'border-border bg-surface'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-bold ${selectedTeacherId === teacher._id ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>{teacher.name.charAt(0).toLocaleUpperCase('vi')}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{teacher.name}</strong><span className="block truncate text-[11px] font-medium text-muted">{teacher.type.map(teacherTypeLabel).join(' · ')}</span></span>{selectedTeacherId === teacher._id && <CheckCircle2 size={18} className="shrink-0 text-primary" />}</button>)}
            {filteredTeachers.length === 0 && <div className="col-span-full grid min-h-28 place-items-center rounded-xl border border-dashed border-border text-center text-sm text-muted"><div><Search size={24} className="mx-auto mb-2 opacity-50" />Không tìm thấy giáo viên phù hợp</div></div>}
          </div>
          <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-surface pt-4 sm:flex sm:justify-end"><Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={updateChildTeacherMutation.isPending} onClick={() => setFindingTeacherFor(null)}>Hủy</Button><Button type="button" className="w-full sm:w-auto" disabled={updateChildTeacherMutation.isPending} onClick={() => updateChildTeacherMutation.mutate({ child: findingTeacherFor.child, typeCode: findingTeacherFor.typeCode, teacherId: selectedTeacherId || null, teacherPrice: Math.max(Number(teacherHourlySalary) || 130000, 0) })}>{updateChildTeacherMutation.isPending ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}Xác nhận lựa chọn</Button></div>
        </div>}
      </Modal>
      <Modal open={Boolean(receiptGroup)} onClose={() => !copyingReceipt && setReceiptGroup(null)} title="Xuất phiếu" className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto overflow-x-hidden p-3 sm:p-6">
        {receiptData && <div className="grid gap-4">
          <label className="grid gap-2 rounded-2xl border-2 border-blue-400 bg-blue-50 p-4 text-sm font-bold text-blue-900 shadow-lg shadow-blue-500/15 dark:border-blue-500 dark:bg-blue-500/15 dark:text-blue-100">Chọn hình thức thanh toán phần tiền còn lại
            <select value={selectedBankId} onChange={(event) => setSelectedBankId(event.target.value)} className="h-12 rounded-xl border-2 border-blue-300 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15">
              <option value={CASH_PAYMENT}>Thanh toán tiền mặt</option>
              {remainingBankOptions.map((bank) => <option key={bank._id} value={bank._id}>{bank.bankName} · {bank.accountNumber} · {bank.accountHolderName}</option>)}
            </select>
            <span className="text-xs font-normal text-blue-700 dark:text-blue-200">Hình thức đang chọn sẽ được in trên phiếu và hình copy.</span>
            {accountBanksQuery.isError && <span className="text-xs font-normal text-red-600">Không thể tải danh sách tài khoản, đang dùng tài khoản mặc định.</span>}
          </label>
          <div ref={receiptRef} className={`mx-auto overflow-hidden bg-white text-slate-900 ${copyingReceipt ? 'w-[700px] max-w-none p-5' : 'w-full max-w-[700px] p-3 sm:p-5'}`}>
            <div className="border-b-2 border-emerald-500 pb-3 text-center"><h2 className="m-0 text-2xl font-bold">PHIẾU THÔNG TIN HỌC</h2></div>
            <div className={`mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:gap-4 ${copyingReceipt ? 'grid-cols-[1fr_auto] gap-4' : 'grid-cols-1'}`}><div className="min-w-0"><strong className={`block break-words sm:text-xl ${copyingReceipt ? 'text-xl' : 'text-lg'}`}>{receiptData.child?.name || `Trẻ #${receiptGroup?.childId}`}</strong><span className={`block break-words text-slate-600 sm:text-sm ${copyingReceipt ? 'text-sm' : 'text-xs'}`}>Ngày sinh: {formatBirthDate(receiptData.child?.birthDate)}</span></div><div className={`${copyingReceipt ? 'text-right' : 'text-left'} sm:text-right`}><strong className={`block text-emerald-600 sm:text-2xl ${copyingReceipt ? 'text-2xl' : 'text-xl'}`}>{receiptData.days.length} buổi</strong>{receiptData.totalHours > 0 && <span className="text-sm text-slate-500">{receiptData.totalHours}h học</span>}</div></div>
            <div className={`mt-3 grid gap-2 ${receiptData.totalRefund > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><span className="text-xs font-semibold text-emerald-700">Tổng học phí</span><strong className="block text-base text-emerald-700">{formatMoney(receiptData.totals.revenue)}</strong></div>{receiptData.totalRefund > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3"><span className="text-xs font-semibold text-red-700">Hoàn tiền</span><strong className="block text-base text-red-700">{formatMoney(receiptData.totalRefund)}</strong></div>}</div>
            <h3 className="mb-1.5 mt-3 text-sm font-bold uppercase text-slate-700">Lịch học Tháng {selectedMonth}/{selectedYear}</h3>
            <div className="grid gap-4">{receiptData.groups.map((group) => <section key={group.type} className="overflow-hidden rounded-lg border border-slate-300">
              <div className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-3 py-2">
                <strong className="text-sm uppercase text-slate-800">{group.label}</strong>
                <span className="text-xs text-slate-600">{group.days.length} ngày{group.totalHours > 0 ? ` · ${group.totalHours}h` : ''} · <strong className="text-emerald-700">{formatMoney(group.totals.revenue)}</strong></span>
              </div>
              <div className="grid grid-cols-7 border-l border-t border-slate-300">{CALENDAR_WEEKDAYS.map((weekday, weekdayIndex) => <div key={weekday} className={`border-b border-r border-slate-300 px-1 py-2 text-center text-xs font-bold ${weekdayIndex >= 5 ? 'bg-slate-200' : 'bg-amber-100'}`}>{weekday}</div>)}{calendarDays.map((day, index) => {
                if (!day) return <div key={`${group.type}-empty-${index}`} className="min-h-20 border-b border-r border-slate-300 bg-slate-50" />
                const items = group.days.filter((item) => Number(item.date.slice(8, 10)) === day && (isFullDayType(item.attendanceType) || item.absent || item.spendTime > 0))
                return <div key={`${group.type}-${day}`} className={`min-h-20 border-b border-r border-slate-300 p-1.5 ${items.some((item) => !item.absent) ? 'bg-emerald-50' : items.some((item) => item.absent) ? 'bg-amber-50' : 'bg-white'}`}><strong className="block text-sm">{day}</strong>{items.map((item) => <div key={`${item.attendanceType}-${item.date}`} className={`mt-1 text-[11px] leading-snug ${item.absent ? 'text-amber-700' : 'text-emerald-700'}`}><strong>{item.absent ? 'Nghỉ' : isFullDayType(item.attendanceType) ? 'Học' : `${item.lessonType || 'HỌC'} · ${formatDuration(item.spendTime)}`}</strong>{item.refund > 0 && <span className="block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</div>)}</div>
              })}</div>
            </section>)}</div>
            {receiptData.child?.isInvoice && <div className={`mt-3 grid items-center gap-3 rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-900 sm:grid-cols-[1fr_auto] ${copyingReceipt ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}><div className="min-w-0 break-words"><strong className="block text-base">Phần xuất hóa đơn</strong><span className="block">Chuyển vào tài khoản công ty: <strong className="text-base text-red-700">{formatMoney(invoiceAmount)}</strong></span><span className="mt-1 block">Ngân hàng: <strong>{companyBank?.bankName || 'Vietcombank'}</strong></span><span className="block">Số tài khoản: <strong>{companyBank?.accountNumber || '1057884906'}</strong></span><span className="block">Chủ tài khoản: <strong>{companyBank?.accountHolderName || 'CTY TNHH TV VA HO TRO GIAO DUC NANG MAI'}</strong></span><span className="block">Nội dung: <strong>{childName}</strong></span></div>{companyQrQuery.data ? <img src={companyQrQuery.data} alt={`QR chuyển khoản hóa đơn cho ${childName}`} className={`h-40 w-40 rounded-lg bg-white object-contain sm:mx-0 ${copyingReceipt ? 'mx-0' : 'mx-auto'}`} /> : <div className={`grid h-40 w-40 place-items-center rounded-lg bg-white text-xs text-slate-500 sm:mx-0 ${copyingReceipt ? 'mx-0' : 'mx-auto'}`}>Đang tải QR...</div>}</div>}
            <div className={`mt-3 grid items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-blue-900 ${isCashPayment ? 'grid-cols-1' : copyingReceipt ? 'grid-cols-[1fr_auto]' : 'grid-cols-1 sm:grid-cols-[1fr_auto]'}`}><div className="min-w-0 break-words"><strong className="block text-base">{receiptData.child?.isInvoice ? 'Phần tiền còn lại' : 'Thông tin thanh toán'}</strong>{receiptData.child?.isInvoice && <span className="block">Số tiền còn lại: <strong className="text-base text-blue-700">{formatMoney(remainingAmount)}</strong></span>}{isCashPayment ? <span className="mt-1 block font-semibold">Phụ huynh thanh toán tiền mặt{!receiptData.child?.isInvoice && <>: <strong className="text-base text-red-600">{formatMoney(remainingAmount)}</strong></>} ạ</span> : remainingBank ? <><span className="mt-1 block">Ngân hàng: {remainingBank.bankName}</span><span className="block">Số tài khoản: <strong>{remainingBank.accountNumber}</strong></span><span className="block">Chủ tài khoản: <strong>{remainingBank.accountHolderName}</strong></span><span className="block">Nội dung: <strong>{childName}</strong></span></> : <span className="mt-1 block font-semibold text-red-600">Vui lòng chọn hình thức thanh toán.</span>}</div>{!isCashPayment && (selectedBankQrQuery.data ? <img src={selectedBankQrQuery.data} alt={`QR chuyển khoản cho ${childName}`} className={`h-40 w-40 rounded-lg bg-white object-contain sm:mx-0 ${copyingReceipt ? 'mx-0' : 'mx-auto'}`} /> : <div className={`grid h-40 w-40 place-items-center rounded-lg bg-white text-xs text-slate-500 sm:mx-0 ${copyingReceipt ? 'mx-0' : 'mx-auto'}`}>{remainingBank ? 'Đang tải QR...' : 'Chưa chọn tài khoản'}</div>)}</div>
            <p className="mb-0 mt-3 text-center text-xs text-slate-400">Phiếu được tổng hợp từ hệ thống quản lý</p>
          </div>
          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-surface pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={copyingReceipt} onClick={() => setReceiptGroup(null)}>Đóng</Button><Button type="button" className="w-full sm:w-auto" disabled={copyingReceipt || !qrImagesReady} onClick={copyReceiptImage}>{copyingReceipt ? <Loader2 size={16} className="spin" /> : <Copy size={16} />}{qrImagesReady ? 'Copy hình' : 'Đang tải QR...'}</Button></div>
        </div>}
      </Modal>
      <Modal
        open={Boolean(editingDay)}
        onClose={() => !dayMutation.isPending && setEditingDay(null)}
        title="Chỉnh sửa buổi học"
        description={editingDay ? new Date(`${editingDay.date}T00:00:00`).toLocaleDateString('vi-VN') : undefined}
        className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto"
      >
        <form onSubmit={(event) => {
          event.preventDefault()
          if (!editingDay) return
          const spendTime = Number(editSpendTime.replace(',', '.'))
          const refund = Number(editRefund) || 0
          if (!isFullDayType(editingDay.attendanceType) && (!Number.isFinite(spendTime) || spendTime <= 0)) return toast.error('Số giờ học không hợp lệ')
          if (refund < 0) return toast.error('Số tiền hoàn không hợp lệ')
          dayMutation.mutate({
            attendanceId: editingDay.attendanceId,
            childId: '',
            date: editingDay.date,
            attendanceType: editingDay.attendanceType,
            attended: true,
            spendTime: isFullDayType(editingDay.attendanceType) ? 0 : spendTime,
            defaultTeacherId: editTeacherId || editingDay.defaultTeacherId,
            absent: editAbsent,
            refund,
            notes: editNotes.trim(),
            lessonType: editLessonType.trim() || 'HỌC',
          })
        }} className="grid gap-5">
          <section className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <div className="flex items-center justify-between gap-2"><strong className="text-sm text-emerald-800 dark:text-emerald-200">Kế hoạch ngày này</strong>{editingDayPlanQuery.isFetching && <Loader2 size={14} className="spin text-emerald-600" />}</div>
            {editingDayPlanQuery.isError && <span className="text-xs text-red-600">Không thể tải kế hoạch.</span>}
            {editingDayPlanQuery.isSuccess && editingDayPlanItems.length === 0 && <span className="text-xs text-emerald-700/70 dark:text-emerald-200/70">Chưa có nội dung kế hoạch cho ngày này.</span>}
            {editingDayPlanItems.length > 0 && <div className="grid max-h-52 gap-2 overflow-y-auto pr-1">{editingDayPlanItems.map((item) => <div key={item.key} className="rounded-lg border border-emerald-200 bg-white p-2.5 dark:border-emerald-500/20 dark:bg-surface"><strong className="block text-xs text-emerald-800 dark:text-emerald-200">{item.title}</strong><p className="m-0 mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-main">{item.content}</p></div>)}</div>}
          </section>
          {editingDay && !isFullDayType(editingDay.attendanceType) && <label className="grid gap-2 text-sm font-semibold">
            Loại buổi học
            <span className="flex flex-wrap gap-2">
              {LESSON_TYPES.map(([lessonType, label]) => <button key={lessonType} type="button" onClick={() => { setEditLessonType(lessonType); setCustomLessonType(false) }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${!customLessonType && editLessonType === lessonType ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>{label}</button>)}
              <button type="button" onClick={() => { setCustomLessonType(true); if (LESSON_TYPES.some(([type]) => type === editLessonType)) setEditLessonType('') }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${customLessonType ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>Khác</button>
            </span>
            {customLessonType && <input value={editLessonType} onChange={(event) => setEditLessonType(event.target.value.toLocaleUpperCase('vi'))} placeholder="Nhập loại buổi học" className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />}
          </label>}
          {editingDay && !isFullDayType(editingDay.attendanceType) && <label className="grid gap-2 text-sm font-semibold">
            Thời lượng
            <span className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => <button key={preset.minutes} type="button" onClick={() => { setEditSpendTime(String(preset.minutes / 60)); setCustomSpendTime(false) }} className={`h-10 rounded-xl border px-3 text-sm font-bold transition ${!customSpendTime && durationMinutes(editSpendTime) === preset.minutes ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>{preset.label}</button>)}
              <button type="button" onClick={() => setCustomSpendTime(true)} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${customSpendTime ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>Tùy chỉnh</button>
            </span>
            {customSpendTime && <span className="grid gap-1.5 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-500/10"><span className="text-xs text-muted">Tổng số phút</span><input type="number" min="1" step="1" value={durationMinutes(editSpendTime) || ''} onChange={(event) => setEditSpendTime(event.target.value ? String(Number(event.target.value) / 60) : '')} placeholder="Ví dụ: 75" className="h-10 rounded-xl border border-border bg-surface px-3 font-normal outline-none focus:border-primary" /></span>}
            <span className="text-xs font-normal text-muted">Đang chọn: <strong className="text-primary">{formatDuration(editSpendTime)}</strong></span>
          </label>}
          {editingDay && needsTeacher(editingDay.attendanceType) && <label className="grid gap-2 text-sm font-semibold">
            Giáo viên
            <select value={editTeacherId} onChange={(event) => setEditTeacherId(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary">
              <option value="">Chọn giáo viên</option>
              {(teachersQuery.data || []).filter((teacher) => teacher.active).map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}
            </select>
            <span className={`rounded-lg border-l-4 px-3 py-2 font-normal ${editTeacherName ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200' : 'border-slate-300 bg-surface-muted text-muted'}`}>Đang chọn: <strong>{editTeacherName || 'Chưa chọn giáo viên'}</strong></span>
          </label>}
          <label className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-300">
            <input type="checkbox" checked={editAbsent} onChange={(event) => setEditAbsent(event.target.checked)} className="h-4 w-4 accent-primary" />
            Bé nghỉ buổi này
          </label>
          {!isTeacherSession && <label className="grid gap-2 text-sm font-semibold">
            Hoàn tiền (refund)
            <input type="number" min="0" step="1000" value={editRefund} onChange={(event) => setEditRefund(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />
          </label>}
          <label className="grid gap-2 text-sm font-semibold">
            Ghi chú
            <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} placeholder="Nhập ghi chú cho ngày này" className="rounded-xl border border-border bg-app-background px-3 py-2 font-normal outline-none focus:border-primary" />
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="danger" className="mr-auto" disabled={dayMutation.isPending} onClick={() => {
              if (!editingDay) return
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
