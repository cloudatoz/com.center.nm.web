import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Check, CheckCircle2, Copy, ExternalLink, FileImage, Loader2, Pencil, Search, Table2, Trash2, XCircle } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { boardingTotal, configForAttendance, lessonConfigType } from '@/lib/child-pricing'
import { getAccountBanks, getVietQrImage } from '@/services/apis/account-bank-api'
import { createAttendance, deleteAttendanceDay, type AttendanceType, getMonthlyAttendances, type MonthlyAttendance, setAttendanceCompleted, updateAttendanceDay } from '@/services/apis/attendance-api'
import { type Child, type ChildTypeCode, updateChild } from '@/services/apis/children-api'
import { getTeachers } from '@/services/apis/teachers-api'
import { ChildTypeEditor, readTypeConfigs } from './child-type-editor'

type TypeFilter = AttendanceType | 'ALL'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2019 + 2 },
  (_, index) => 2020 + index,
)
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const CALENDAR_WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const CASH_PAYMENT = 'CASH'
const FIND_TEACHER_BUTTON_CLASS = 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25'
const LESSON_TYPES = [
  ['HỌC', 'Học'], ['VẼ', 'Vẽ'], ['NGOẠI NGỮ', 'Ngoại ngữ'], ['VẬN ĐỘNG', 'Vận động'],
] as const
const isFullDayType = (type: AttendanceType) => type === 'CA_NGAY' || type === 'SHADOW'
const needsTeacher = (type: AttendanceType) => type !== 'CA_NGAY'
const attendanceTypeLabel = (type: AttendanceType) => ({
  THEO_BUOI: 'Cá nhân', CA_NGAY: 'Cả ngày', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow',
})[type]

function AttendanceStatusList({ rows }: { rows: MonthlyAttendance[] }) {
  return <div className="grid gap-1 rounded-lg border border-border bg-app-background p-2">
    <strong className="text-xs text-text-main">Điểm danh</strong>
    {rows.map((row) => <span key={row._id} className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold ${row.isCompleted ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
      {row.isCompleted ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {attendanceTypeLabel(row.type)}: {row.isCompleted ? 'Hoàn thành' : 'Chưa'}
    </span>)}
  </div>
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
const openPlanLink = (planLink?: string) => {
  const value = planLink?.trim()
  if (!value) return toast.error('Chưa có đường link kế hoạch')
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

function attendanceTotals(attendance: MonthlyAttendance) {
  const child = typeof attendance.children === 'string' ? null : attendance.children
  if (isFullDayType(attendance.type)) {
    return {
      revenue: attendance.type === 'CA_NGAY' ? boardingTotal(child) -
        attendance.days.reduce((total, day) => total + day.refund, 0) :
        attendance.days.reduce((total, day) => total + day.spendTime * day.tuitionFee - day.refund, 0),
      expense: attendance.type === 'CA_NGAY' ? 0 :
        attendance.days.reduce((total, day) => total + day.spendTime * day.salaryTeacher, 0),
    }
  }
  return attendance.days.reduce((total, day) => ({
    revenue: total.revenue + day.spendTime * day.tuitionFee - day.refund,
    expense: total.expense + day.spendTime * day.salaryTeacher,
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
  const [selectedBankId, setSelectedBankId] = useState('')
  const [findingTeacherFor, setFindingTeacherFor] = useState<{ child: Child; childName: string; typeCode: ChildTypeCode; teacherId?: string | null } | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherHourlySalary, setTeacherHourlySalary] = useState('130000')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
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
  const teachersQuery = useQuery({
    queryKey: ['teachers'],
    queryFn: getTeachers,
    enabled: Boolean(editingChild || findingTeacherFor || (editingDay && needsTeacher(editingDay.attendanceType))),
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
  const editModeMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      if (completed) return setAttendanceCompleted(id, false)
      return null
    },
    onSuccess: (updated, { id }) => {
      if (updated) updateCachedAttendance(updated)
      setEditingIds((current) => new Set(current).add(id))
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể mở chỉnh sửa'),
  })
  const finishEditMutation = useMutation({
    mutationFn: (id: string) => setAttendanceCompleted(id, true),
    onSuccess: (updated, id) => {
      updateCachedAttendance(updated)
      setEditingIds((current) => { const next = new Set(current); next.delete(id); return next })
      toast.success('Đã lưu lịch sử học')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu lịch sử học'),
  })
  const dayMutation = useMutation({
    mutationFn: async ({ attendanceId, childId, date, attendanceType, attended, spendTime, defaultTeacherId, absent, refund, notes, lessonType }: { attendanceId: string; childId: string; date: string; attendanceType: AttendanceType; attended: boolean; spendTime?: number; defaultTeacherId?: string | null; absent?: boolean; refund?: number; notes?: string; lessonType?: string }) => {
      const selectedTeacherId = defaultTeacherId || undefined
      if (!attended) return createAttendance(childId, date, attendanceType === 'CA_NGAY' ? 0 : spendTime || 1, attendanceType, selectedTeacherId)
      if (spendTime !== undefined) return updateAttendanceDay(attendanceId, date, spendTime, needsTeacher(attendanceType) ? selectedTeacherId : undefined, absent, refund, notes, lessonType)
      return deleteAttendanceDay(childId, date, attendanceType)
    },
    onSuccess: (updated) => { updateCachedAttendance(updated); setEditingDay(null); toast.success('Đã cập nhật ngày học') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật ngày học'),
  })
  const updateChildTeacherMutation = useMutation({
    mutationFn: ({ child, typeCode, teacherId, teacherPrice }: { child: Child; typeCode: ChildTypeCode; teacherId: string | null; teacherPrice: number }) =>
      updateChild(child._id, {
        type: child.type.map((config) => config.type === typeCode
          ? { ...config, teacherId, teacherPrice }
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
    onSuccess: (updated) => {
      updateCachedChild(updated)
      setEditingChild(null)
      toast.success('Đã cập nhật thông tin trẻ')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trẻ'),
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
    }
    updateChildMutation.mutate({ id: editingChild._id, data })
  }
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
      for (const config of child?.type || []) {
        if (config.teacherId && config.teacherName) teachers.set(config.teacherId, config.teacherName)
      }
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
      const teacherNames = [...(child?.type || []).map((config) => config.teacherName), ...attendance.days.map((day) => day.teacherName)]
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
    setCustomSpendTime(!['1', '1.5', '2', '2.5', '3'].includes(value))
    setEditTeacherId(item.teacherId || defaultTeacherId || '')
    setEditAbsent(item.absent)
    setEditRefund(String(item.refund || 0))
    setEditNotes(item.notes || '')
    setEditLessonType(item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC'))
    setCustomLessonType(!LESSON_TYPES.some(([type]) => type === (item.lessonType || (item.notes === 'Vẽ' ? 'VẼ' : 'HỌC'))))
  }
  const confirmEditingFromCell = async (attendance: MonthlyAttendance, childNameValue: string) => {
    if (editingIds.has(attendance._id)) return true
    if (!window.confirm(`Bạn muốn điểm danh bé '${childNameValue}' không?`)) return false
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
              <option value="THEO_BUOI">Cá nhân</option>
              <option value="CA_NGAY">Cả ngày</option>
              <option value="TAI_NHA">Tại nhà</option>
              <option value="SHADOW">Shadow</option>
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
                const boardingRow = childRows.find((row) => row.type === 'CA_NGAY')
                const sessionRow = childRows.find((row) => row.type === 'THEO_BUOI')
                const latestDay = (items: typeof attendance.days) => items.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, items[0])
                const boardingSnapshot = latestDay(boardingRow?.days || [])
                const sessionSnapshot = latestDay(sessionRow?.days || [])
                const attendanceByDay = new Map(
                  attendance.days.map((item) => [Number(item.date.slice(8, 10)), item]),
                )
                const rowTotals = attendanceTotals(attendance)
                const pricingConfig = configForAttendance(child as Child | null, attendance.type, sessionSnapshot?.lessonType)
                return (
                  <TableRow key={attendance._id} className="group">
                    {showChild && <TableCell rowSpan={childRowCount} className="z-10 hidden w-64 min-w-64 max-w-64 border-r border-border bg-surface align-top shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)] sm:sticky sm:left-0 sm:table-cell">
                      <div className="grid gap-2"><div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10">
                        <img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-11 w-11 shrink-0 rounded-xl bg-surface-muted object-cover" />
                        <div className="min-w-0">
                          <strong className="block max-w-40 whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${attendance.children}`}</strong>
                          <span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span>
                        </div>
                      </div><Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button><Button type="button" size="sm" variant="secondary" onClick={() => openPlanLink(child?.planLink)}><ExternalLink size={13} />Kế hoạch</Button><Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows: childRows })}><FileImage size={13} />Xuất phiếu</Button><AttendanceStatusList rows={childRows} /></div>
                    </TableCell>}
                    <TableCell className="text-center">
                      <strong className="mb-1 block max-w-32 whitespace-normal rounded-lg border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs leading-snug text-text-main dark:border-blue-500/30 dark:bg-blue-500/10 sm:hidden">{child?.name || `Trẻ #${attendance.children}`}</strong>
                      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${isFullDayType(attendance.type) ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendanceTypeLabel(attendance.type)}</span>
                      {needsTeacher(attendance.type) ? <div className="mx-auto mt-1 grid max-w-40 gap-0.5 text-[10px] text-muted"><span>GV: <strong className="text-blue-600 dark:text-blue-400">{pricingConfig?.teacherName || 'Chưa cập nhật'}</strong></span>{child && <Button type="button" size="sm" variant="secondary" className={`mx-auto my-1 ${FIND_TEACHER_BUTTON_CLASS}`} onClick={() => { setFindingTeacherFor({ child: child as Child, childName: child.name || `Trẻ #${childId}`, typeCode: pricingConfig?.type || lessonConfigType(sessionSnapshot?.lessonType), teacherId: pricingConfig?.teacherId }); setTeacherSearch(''); setTeacherHourlySalary(String(pricingConfig?.teacherPrice || 130000)); setSelectedTeacherId(pricingConfig?.teacherId || '') }}><Search size={12} />Tìm GV</Button>}<span>Lương GV 1h: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(sessionSnapshot?.salaryTeacher || pricingConfig?.teacherPrice || 0)}</strong></span><span>Học phí 1h: <strong className="text-emerald-600 dark:text-emerald-300">{formatMoney(sessionSnapshot?.tuitionFee || pricingConfig?.price || 0)}</strong></span></div> : <span className="mx-auto mt-1 block text-[10px] text-muted">Học phí tháng: <strong className="text-red-600 dark:text-red-400">{formatMoney(pricingConfig?.prices.tuition || 0)}</strong><span className="block">CSVC: {formatMoney(pricingConfig?.prices.csvc || 0)} · Ăn: {formatMoney(pricingConfig?.prices.meal || 0)}</span></span>}
                      <span className="mx-auto mt-1 block whitespace-nowrap text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">Thu: {formatMoney(rowTotals.revenue)}</span>
                      <span className="mx-auto block whitespace-nowrap text-[10px] font-semibold text-red-600 dark:text-red-300">Chi: {formatMoney(rowTotals.expense)}</span>
                      {attendance.isCompleted && <span className="mx-auto mt-1 flex w-fit items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><CheckCircle2 size={10} />Hoàn tất</span>}
                      {editingIds.has(attendance._id) ? <Button type="button" size="sm" variant="secondary" className="complete-attention mx-auto mt-2" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance._id)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button> : <Button type="button" size="sm" variant="secondary" className="edit-attention mx-auto mt-2" disabled={editModeMutation.isPending} onClick={() => editModeMutation.mutate({ id: attendance._id, completed: attendance.isCompleted })}><Pencil size={13} />Sửa</Button>}
                    </TableCell>
                    {days.map((day) => {
                      const item = attendanceByDay.get(day)
                      return (
                        <TableCell key={day} className="p-1 text-center">
                          <button type="button" disabled={dayMutation.isPending} onClick={async () => {
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            if (!await confirmEditingFromCell(attendance, child?.name || `Trẻ #${childId}`)) return
                            if (item) {
                              openDayEditor(attendance, date, item, pricingConfig?.teacherId)
                              return
                            }
                            if (needsTeacher(attendance.type) && !item && !pricingConfig?.teacherId) return toast.error('Trẻ chưa có giáo viên mặc định')
                            dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: Boolean(item), defaultTeacherId: pricingConfig?.teacherId })
                          }} className={`mx-auto grid min-h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-1 py-1 text-[10px] font-bold transition ${item ? item.absent ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'text-muted/40'} ${editingIds.has(attendance._id) ? 'ring-1 ring-primary/30 hover:bg-primary/10' : 'hover:bg-primary/5 hover:ring-1 hover:ring-primary/20'} disabled:opacity-70`} title={editingIds.has(attendance._id) ? item ? 'Bấm để sửa buổi học' : 'Bấm để thêm ngày học' : `Bấm để điểm danh bé ${child?.name || childId}`}>{item ? isFullDayType(attendance.type) ? <span><span className="block">{item.absent ? 'Nghỉ' : <Check size={15} />}</span>{!item.absent && item.teacherName && <span className="mt-0.5 block max-w-20 truncate font-medium">{item.teacherName}</span>}{item.refund > 0 && <span className="mt-0.5 block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</span> : <span><span className="block">{item.absent ? 'Nghỉ' : `${item.lessonType || 'HỌC'} · ${item.spendTime}h`}</span>{!item.absent && item.teacherName && <span className="mt-0.5 block max-w-20 truncate font-medium">{item.teacherName}</span>}{item.refund > 0 && <span className="mt-0.5 block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</span> : '—'}</button>
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
              const boardingRow = rows.find((row) => row.type === 'CA_NGAY')
              const sessionSnapshot = sessionRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, sessionRow.days[0])
              const boardingSnapshot = boardingRow?.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, boardingRow.days[0])
              return <div key={childId} className="min-w-0 overflow-x-auto overscroll-x-contain">
                <div className="grid min-w-[420px] grid-cols-1 sm:min-w-[700px] sm:grid-cols-[12rem_minmax(490px,1fr)]">
                  <div className="left-0 z-10 hidden border-r border-border bg-surface-muted p-3 shadow-[6px_0_10px_-8px_rgba(15,23,42,0.5)] sm:sticky sm:block">
                    <div className="sticky top-3 grid gap-2"><div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10">
                      <img src={child?.avatar || defaultAvatar(child?.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child?.gender) }} alt={`Ảnh ${child?.name || 'trẻ'}`} className="h-10 w-10 shrink-0 rounded-lg bg-surface-muted object-cover" />
                      <div className="min-w-0"><strong className="block whitespace-normal break-words leading-snug">{child?.name || `Trẻ #${childId}`}</strong><span className="block text-xs text-muted">{formatBirthDate(child?.birthDate)}</span></div></div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => openPlanLink(child?.planLink)}><ExternalLink size={13} />Kế hoạch</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows })}><FileImage size={13} />Xuất phiếu</Button>
                      <AttendanceStatusList rows={rows} />
                    </div>
                  </div>
                  <div className="grid gap-3 p-3">
                    <div className="grid gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2 dark:border-blue-500/30 dark:bg-blue-500/10 sm:hidden">
                      <strong className="min-w-0 truncate text-sm">{child?.name || `Trẻ #${childId}`}</strong>
                      <div className="grid grid-cols-2 items-start gap-2">
                        <div className="grid gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => child && setEditingChild(child)}><Pencil size={13} />Cập nhật Trẻ</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => openPlanLink(child?.planLink)}><ExternalLink size={13} />Kế hoạch</Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setReceiptGroup({ childId, rows })}><FileImage size={13} />Xuất phiếu</Button>
                        </div>
                        <AttendanceStatusList rows={rows} />
                      </div>
                    </div>
                    {rows.map((attendance) => {
                      const rowTotals = attendanceTotals(attendance)
                      const attendanceByDay = new Map(attendance.days.map((item) => [Number(item.date.slice(8, 10)), item]))
                      const latestSnapshot = attendance.days.reduce((latest, item) => !latest || item.date > latest.date ? item : latest, attendance.days[0])
                      const pricingConfig = configForAttendance(child as Child | null, attendance.type, latestSnapshot?.lessonType)
                      return <section key={attendance._id} className="grid gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2"><strong className="mr-1 text-sm text-text-main sm:hidden">{child?.name || `Trẻ #${childId}`}</strong><span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${isFullDayType(attendance.type) ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{attendanceTypeLabel(attendance.type)}</span><span className="text-xs font-semibold text-emerald-600">Thu: {formatMoney(rowTotals.revenue)}</span><span className="text-xs font-semibold text-red-600">Chi: {formatMoney(rowTotals.expense)}</span>{attendance.isCompleted && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={13} />Hoàn tất</span>}</div>
                          <div className="hidden sm:block">{editingIds.has(attendance._id) ? <Button type="button" size="sm" variant="secondary" className="complete-attention h-7 px-2 text-sm" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance._id)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button> : <Button type="button" size="sm" variant="secondary" className="edit-attention h-7 px-2 text-sm" disabled={editModeMutation.isPending} onClick={() => editModeMutation.mutate({ id: attendance._id, completed: attendance.isCompleted })}><Pencil size={13} />Sửa</Button>}</div>
                        </div>
                        {needsTeacher(attendance.type) ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-purple-50/70 px-2.5 py-2 text-xs dark:bg-purple-500/10"><span>GV: <strong className="text-blue-600 dark:text-blue-400">{pricingConfig?.teacherName || 'Chưa cập nhật'}</strong></span>{child && <Button type="button" size="sm" variant="secondary" className={FIND_TEACHER_BUTTON_CLASS} onClick={() => { setFindingTeacherFor({ child: child as Child, childName: child.name || `Trẻ #${childId}`, typeCode: pricingConfig?.type || lessonConfigType(latestSnapshot?.lessonType), teacherId: pricingConfig?.teacherId }); setTeacherSearch(''); setTeacherHourlySalary(String(pricingConfig?.teacherPrice || 130000)); setSelectedTeacherId(pricingConfig?.teacherId || '') }}><Search size={12} />Tìm GV</Button>}<span>Lương GV 1h: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(latestSnapshot?.salaryTeacher || pricingConfig?.teacherPrice || 0)}</strong></span><span>Học phí 1h: <strong className="text-emerald-600 dark:text-emerald-300">{formatMoney(latestSnapshot?.tuitionFee || pricingConfig?.price || 0)}</strong></span></div> : <div className="rounded-lg bg-blue-50/70 px-2.5 py-2 text-xs dark:bg-blue-500/10">Học phí tháng: <strong className="text-red-600 dark:text-red-400">{formatMoney(pricingConfig?.prices.tuition || 0)}</strong><span className="ml-2">CSVC: {formatMoney(pricingConfig?.prices.csvc || 0)} · Ăn: {formatMoney(pricingConfig?.prices.meal || 0)}</span></div>}
                        <div className="flex justify-end sm:hidden">{editingIds.has(attendance._id) ? <Button type="button" size="sm" variant="secondary" className="complete-attention w-full" disabled={finishEditMutation.isPending || dayMutation.isPending} onClick={() => finishEditMutation.mutate(attendance._id)}><CheckCircle2 size={13} />Hoàn tất điểm danh</Button> : <Button type="button" size="sm" variant="secondary" className="edit-attention w-full" disabled={editModeMutation.isPending} onClick={() => editModeMutation.mutate({ id: attendance._id, completed: attendance.isCompleted })}><Pencil size={13} />Sửa</Button>}</div>
                        <div className="grid min-w-0 grid-cols-7 gap-0.5 sm:gap-1">{CALENDAR_WEEKDAYS.map((weekday, weekdayIndex) => <div key={weekday} className={`min-w-0 border-b border-r border-border px-0.5 py-1.5 text-center text-[11px] font-bold text-muted last:border-r-0 sm:px-1 sm:text-[13px] lg:text-sm ${weekdayIndex >= 5 ? 'bg-slate-200/80 dark:bg-slate-700/70' : 'bg-amber-100/90 dark:bg-amber-500/20'}`}>{weekday}</div>)}
                          {calendarDays.map((day, index) => {
                            const isWeekend = index % 7 >= 5
                            if (!day) return <div key={`empty-${index}`} className={isWeekend ? 'min-h-16 rounded-md bg-slate-100 dark:bg-slate-800/70 sm:min-h-20 lg:min-h-16' : 'min-h-16 sm:min-h-20 lg:min-h-16'} />
                            const date = `${month}-${String(day).padStart(2, '0')}`
                            const item = attendanceByDay.get(day)
                            return <button key={date} type="button" disabled={dayMutation.isPending} onClick={async () => {
                              if (!await confirmEditingFromCell(attendance, child?.name || `Trẻ #${childId}`)) return
                              if (item) return openDayEditor(attendance, date, item, pricingConfig?.teacherId)
                              if (needsTeacher(attendance.type) && !pricingConfig?.teacherId) return toast.error('Trẻ chưa có giáo viên mặc định')
                              dayMutation.mutate({ attendanceId: attendance._id, childId, date, attendanceType: attendance.type, attended: false, defaultTeacherId: pricingConfig?.teacherId })
                            }} className={`relative flex min-h-16 min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border p-1 pt-5 text-left transition sm:min-h-20 sm:p-1.5 sm:pt-6 lg:min-h-16 lg:pt-6 ${item ? item.absent ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-surface'} ${isWeekend ? '!bg-slate-100 dark:!bg-slate-800/80' : ''} hover:border-primary/50 hover:ring-1 hover:ring-primary/20 disabled:opacity-80`} title={editingIds.has(attendance._id) ? item ? 'Bấm để chỉnh sửa' : 'Bấm để điểm danh' : `Bấm để điểm danh bé ${child?.name || childId}`}>
                              <span className="absolute left-1 top-1 text-sm font-bold sm:left-1.5 sm:text-base lg:text-lg">{day}</span>{item && <span className="mt-auto block min-w-0 text-[10px] font-semibold leading-snug sm:text-xs lg:text-sm"><span className="block">{item.absent ? 'Nghỉ' : isFullDayType(attendance.type) ? 'Học' : `${item.lessonType || 'HỌC'} · ${item.spendTime}h`}</span>{!item.absent && item.teacherName && <span className="block truncate opacity-80">{item.teacherName}</span>}{item.refund > 0 && <span className="block truncate text-red-600">Hoàn {formatMoney(item.refund)}</span>}{item.notes && item.notes.trim().toLocaleUpperCase('vi') !== (item.lessonType || 'HỌC').trim().toLocaleUpperCase('vi') && <span className="block truncate text-[10px] font-normal opacity-75 sm:text-[11px] lg:text-xs">{item.notes}</span>}</span>}
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
      <Modal open={Boolean(editingChild)} onClose={() => !updateChildMutation.isPending && setEditingChild(null)} title="Cập nhật Trẻ" description={editingChild?.name} className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {editingChild && <form onSubmit={submitChildUpdate} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">Họ và tên<input name="name" defaultValue={editingChild.name} required className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Giới tính<select name="gender" defaultValue={editingChild.gender} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary"><option value="male">Nam</option><option value="female">Nữ</option></select></label>
            <label className="grid gap-1.5 text-sm font-semibold">Trạng thái<select name="status" defaultValue={editingChild.status} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary"><option value="DANG_HOC">Đang học</option><option value="NGHI_HOC">Đã nghỉ</option></select></label>
            <label className="grid gap-1.5 text-sm font-semibold">Ngày nghỉ học<input name="offAt" type="date" defaultValue={formatDateInput(editingChild.offAt)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Ngày sinh<input name="birthDate" type="date" defaultValue={formatDateInput(editingChild.birthDate)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Số điện thoại<input name="phone" defaultValue={editingChild.phone} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
            <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Link kế hoạch<input name="planLink" type="url" defaultValue={editingChild.planLink} placeholder="https://..." className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
          </div>
          <ChildTypeEditor initial={editingChild.type} teachers={teachersQuery.data || []} />
          <label className="grid gap-1.5 text-sm font-semibold">Số tiền hóa đơn<input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={editingChild.invoiceAmount} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isInvoice" type="checkbox" defaultChecked={editingChild.isInvoice} className="h-4 w-4 accent-primary" />Xuất hóa đơn</label>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" disabled={updateChildMutation.isPending} onClick={() => setEditingChild(null)}>Hủy</Button><Button type="submit" disabled={updateChildMutation.isPending}>{updateChildMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div>
        </form>}
      </Modal>
      <Modal open={Boolean(findingTeacherFor)} onClose={() => !updateChildTeacherMutation.isPending && setFindingTeacherFor(null)} title="Tìm giáo viên" description={findingTeacherFor?.childName} className="max-w-lg">
        {findingTeacherFor && <div className="grid gap-4">
          <label className="relative"><span className="sr-only">Tìm tên giáo viên</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" autoFocus value={teacherSearch} onChange={(event) => setTeacherSearch(event.target.value)} placeholder="Nhập tên giáo viên..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Lương GV 1h<input type="number" min="0" step="1000" value={teacherHourlySalary} onChange={(event) => setTeacherHourlySalary(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" /></label>
          <div className="grid max-h-72 gap-2 overflow-y-auto">
            <button type="button" disabled={updateChildTeacherMutation.isPending} onClick={() => setSelectedTeacherId('')} className={`rounded-xl border p-3 text-left text-sm font-semibold transition hover:border-primary hover:bg-primary/5 ${!selectedTeacherId ? 'border-primary bg-primary/5 text-primary' : 'border-border'}`}>Chưa chọn giáo viên</button>
            {filteredTeachers.map((teacher) => <button key={teacher._id} type="button" disabled={updateChildTeacherMutation.isPending} onClick={() => setSelectedTeacherId(teacher._id)} className={`flex items-center justify-between rounded-xl border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${selectedTeacherId === teacher._id ? 'border-primary bg-primary/5' : 'border-border'}`}><span><strong className="block text-sm">{teacher.name}</strong><span className="text-xs text-muted">{teacher.phone || teacher.email}</span></span>{selectedTeacherId === teacher._id && <CheckCircle2 size={18} className="text-primary" />}</button>)}
            {filteredTeachers.length === 0 && <p className="m-0 py-6 text-center text-sm text-muted">Không tìm thấy giáo viên</p>}
          </div>
          {updateChildTeacherMutation.isPending && <span className="flex items-center justify-center gap-2 text-sm text-muted"><Loader2 size={16} className="spin" />Đang cập nhật...</span>}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" disabled={updateChildTeacherMutation.isPending} onClick={() => setFindingTeacherFor(null)}>Hủy</Button><Button type="button" disabled={updateChildTeacherMutation.isPending} onClick={() => updateChildTeacherMutation.mutate({ child: findingTeacherFor.child, typeCode: findingTeacherFor.typeCode, teacherId: selectedTeacherId || null, teacherPrice: Math.max(Number(teacherHourlySalary) || 130000, 0) })}>{updateChildTeacherMutation.isPending && <Loader2 size={16} className="spin" />}Xác nhận</Button></div>
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
            <div className={`mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto] sm:gap-4 ${copyingReceipt ? 'grid-cols-[1fr_auto] gap-4' : 'grid-cols-1'}`}><div className="min-w-0"><strong className={`block break-words sm:text-xl ${copyingReceipt ? 'text-xl' : 'text-lg'}`}>{receiptData.child?.name || `Trẻ #${receiptGroup?.childId}`}</strong><span className={`block break-words text-slate-600 sm:text-sm ${copyingReceipt ? 'text-sm' : 'text-xs'}`}>Ngày sinh: {formatBirthDate(receiptData.child?.birthDate)} · GV: {receiptData.child?.type.map((config) => config.teacherName).filter(Boolean).join(', ') || 'Chưa cập nhật'}</span></div><div className={`${copyingReceipt ? 'text-right' : 'text-left'} sm:text-right`}><strong className={`block text-emerald-600 sm:text-2xl ${copyingReceipt ? 'text-2xl' : 'text-xl'}`}>{receiptData.days.length} buổi</strong>{receiptData.totalHours > 0 && <span className="text-sm text-slate-500">{receiptData.totalHours}h học</span>}</div></div>
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
                return <div key={`${group.type}-${day}`} className={`min-h-20 border-b border-r border-slate-300 p-1.5 ${items.some((item) => !item.absent) ? 'bg-emerald-50' : items.some((item) => item.absent) ? 'bg-amber-50' : 'bg-white'}`}><strong className="block text-sm">{day}</strong>{items.map((item) => <div key={`${item.attendanceType}-${item.date}`} className={`mt-1 text-[11px] leading-snug ${item.absent ? 'text-amber-700' : 'text-emerald-700'}`}><strong>{item.absent ? 'Nghỉ' : isFullDayType(item.attendanceType) ? 'Học' : `${item.lessonType || 'HỌC'} · ${item.spendTime}h`}</strong>{!item.absent && item.teacherName && <span className="block">GV: {item.teacherName}</span>}{item.refund > 0 && <span className="block text-red-600">Hoàn {formatMoney(item.refund)}</span>}</div>)}</div>
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
              {[1, 1.5, 2, 2.5, 3].map((hours) => <button key={hours} type="button" onClick={() => { setEditSpendTime(String(hours)); setCustomSpendTime(false) }} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${!customSpendTime && editSpendTime === String(hours) ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>{hours}h</button>)}
              <button type="button" onClick={() => setCustomSpendTime(true)} className={`h-10 rounded-xl border px-4 text-sm font-bold transition ${customSpendTime ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-main hover:border-primary/50'}`}>Tùy chỉnh</button>
            </span>
            {customSpendTime && <input value={editSpendTime} onChange={(event) => setEditSpendTime(event.target.value)} inputMode="decimal" placeholder="Nhập số giờ" className="h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary" />}
          </label>}
          {editingDay && needsTeacher(editingDay.attendanceType) && <label className="grid gap-2 text-sm font-semibold">
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
