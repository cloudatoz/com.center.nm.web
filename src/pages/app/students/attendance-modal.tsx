import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, CheckCircle2, Loader2, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { configForAttendance } from '@/lib/child-pricing'
import { type AttendanceType, createAttendance, deleteAttendanceDay, getChildMonthlyAttendance, setAttendanceCompleted } from '@/services/apis/attendance-api'
import type { Child } from '@/services/apis/children-api'
import { getTeachers } from '@/services/apis/teachers-api'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from(
  { length: new Date().getFullYear() - 2019 + 2 },
  (_, index) => 2020 + index,
)
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const isFullDayType = (type: AttendanceType) => type === 'CA_NGAY' || type === 'SHADOW'
const needsTeacher = (type: AttendanceType) => type !== 'CA_NGAY'

export function AttendanceModal({ child, initialType, onClose }: { child: Child | null; initialType: AttendanceType; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [spendTime, setSpendTime] = useState(1)
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('THEO_BUOI')
  const [teacherId, setTeacherId] = useState('')
  const [selectedYear, selectedMonth] = month.split('-').map(Number)

  useEffect(() => {
    setAttendanceType(initialType)
  }, [child?._id, initialType])
  const pricingConfig = configForAttendance(child, attendanceType)
  useEffect(() => {
    setTeacherId(pricingConfig?.teacherId || '')
  }, [pricingConfig?.teacherId])
  const queryKey = ['attendance', child?._id, month, attendanceType]
  const attendanceQuery = useQuery({
    queryKey,
    queryFn: () => getChildMonthlyAttendance(child?._id || '', month, attendanceType),
    enabled: Boolean(child),
  })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const activeTeachers = (teachersQuery.data || []).filter((teacher) => teacher.active)
  const mutation = useMutation({
    mutationFn: async ({ date, attended }: { date: string; attended: boolean }) => {
      if (!child) return
      if (attended) await deleteAttendanceDay(child._id, date, attendanceType)
      else {
        if (needsTeacher(attendanceType) && !teacherId) throw new Error('Vui lòng chọn giáo viên')
        await createAttendance(child._id, date, attendanceType === 'CA_NGAY' ? 0 : spendTime, attendanceType, teacherId)
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success(variables.attended ? 'Đã bỏ điểm danh' : 'Điểm danh thành công')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật điểm danh'),
  })
  const completeMutation = useMutation({
    mutationFn: (isCompleted: boolean) => setAttendanceCompleted(attendanceQuery.data?._id || '', isCompleted),
    onSuccess: async (_, isCompleted) => {
      await queryClient.invalidateQueries({ queryKey })
      await queryClient.invalidateQueries({ queryKey: ['attendance-status', month] })
      toast.success(isCompleted ? 'Đã hoàn tất điểm danh tháng' : 'Đã mở lại để chỉnh sửa')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể hoàn tất điểm danh'),
  })
  const calendar = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number)
    const totalDays = new Date(year, monthNumber, 0).getDate()
    const firstDay = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
    return [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: totalDays }, (_, index) => index + 1)]
  }, [month])
  const attendanceByDate = useMemo(
    () => new Map((attendanceQuery.data?.days || []).map((day) => [day.date.slice(0, 10), day])),
    [attendanceQuery.data],
  )
  const totalHours = (attendanceQuery.data?.days || []).reduce((sum, day) => sum + day.spendTime, 0)

  return (
    <Modal open={Boolean(child)} onClose={onClose} title={`Điểm danh - ${child?.name || ''}`} description={`Theo dõi điểm danh theo tháng · Mã trẻ ${child?._id || ''}`} className="max-h-[92vh] max-w-4xl overflow-y-auto">
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 rounded-2xl bg-surface-muted/60 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Loại học<select value={attendanceType} onChange={(event) => setAttendanceType(event.target.value as AttendanceType)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="THEO_BUOI">Cá nhân</option><option value="CA_NGAY">Cả ngày</option><option value="TAI_NHA">Tại nhà</option><option value="SHADOW">Shadow</option></select></label>
            {!isFullDayType(attendanceType) && <label className="grid gap-1.5 text-xs font-semibold text-muted">Số giờ mặc định<select value={spendTime} onChange={(event) => setSpendTime(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value={1}>1h</option><option value={1.5}>1,5h</option><option value={2}>2h</option><option value={2.5}>2,5h</option><option value={3}>3h</option></select></label>}
            {needsTeacher(attendanceType) && <label className="grid gap-1.5 text-xs font-semibold text-muted">Giáo viên<select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-10 min-w-44 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="">Chọn giáo viên</option>{activeTeachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}</select></label>}
          </div>
          {child && <div className="text-xs font-semibold text-muted">{attendanceType === 'CA_NGAY'
            ? `Học phí tháng: ${(pricingConfig?.prices.tuition || 0).toLocaleString('vi-VN')} đ · CSVC: ${(pricingConfig?.prices.csvc || 0).toLocaleString('vi-VN')} đ · Tiền ăn: ${(pricingConfig?.prices.meal || 0).toLocaleString('vi-VN')} đ`
            : `Học phí 1h: ${(pricingConfig?.price || 0).toLocaleString('vi-VN')} đ · Lương GV 1h: ${(pricingConfig?.teacherPrice || 0).toLocaleString('vi-VN')} đ`}</div>}
          <div className="flex flex-wrap items-end gap-4 text-sm"><div><span className="block text-xs text-muted">Số ngày học</span><strong className="text-lg text-primary">{attendanceQuery.data?.days.length || 0}</strong></div>{!isFullDayType(attendanceType) && <div><span className="block text-xs text-muted">Tổng thời gian</span><strong className="text-lg text-primary">{totalHours}h</strong></div>}{attendanceQuery.data?.isCompleted ? <><span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 size={16} />Đã hoàn tất</span><Button type="button" variant="secondary" size="compact" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate(false)}>{completeMutation.isPending ? <Loader2 size={15} className="spin" /> : <Pencil size={15} />}Chỉnh sửa điểm danh</Button></> : <Button type="button" size="compact" disabled={!attendanceQuery.data || completeMutation.isPending || mutation.isPending} onClick={() => completeMutation.mutate(true)}>{completeMutation.isPending ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}Hoàn tất điểm danh</Button>}</div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((weekday) => <div key={weekday} className="py-1 text-center text-[11px] font-bold uppercase text-muted">{weekday}</div>)}
          {calendar.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} />
            const date = `${month}-${String(day).padStart(2, '0')}`
            const attendance = attendanceByDate.get(date)
            const pending = mutation.isPending && mutation.variables?.date === date
            return <button key={date} type="button" disabled={mutation.isPending || attendanceQuery.isLoading || attendanceQuery.data?.isCompleted} onClick={() => mutation.mutate({ date, attended: Boolean(attendance) })} title={attendanceQuery.data?.isCompleted ? 'Bảng điểm danh đã hoàn tất' : attendance ? 'Bấm để bỏ điểm danh' : 'Bấm để điểm danh'} className={`relative min-h-16 rounded-xl border p-1.5 text-left transition sm:min-h-24 sm:p-2 ${attendance ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-red-50 hover:text-red-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : 'border-border bg-surface hover:border-primary/50 hover:bg-primary/5'} disabled:cursor-wait disabled:opacity-60`}><span className="text-xs font-bold sm:text-sm">{day}</span>{pending ? <Loader2 size={15} className="absolute bottom-2 right-2 spin" /> : attendance ? <><CalendarCheck size={15} className="absolute right-2 top-2" /><span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-semibold sm:bottom-2 sm:left-2"><span className="block">{isFullDayType(attendanceType) ? 'Học' : `${attendance.spendTime}h`}</span>{needsTeacher(attendanceType) && attendance.teacherName && <span className="mt-0.5 block truncate font-medium opacity-80">{attendance.teacherName}</span>}</span></> : null}</button>
          })}
        </div>
        {attendanceQuery.isLoading && <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted"><Loader2 size={17} className="spin" />Đang tải điểm danh...</div>}
        {attendanceQuery.isError && <p className="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{attendanceQuery.error instanceof Error ? attendanceQuery.error.message : 'Không thể tải điểm danh'}</p>}
        <p className="m-0 text-xs text-muted"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Ngày màu xanh đã được điểm danh. Bấm lại để bỏ điểm danh.</p>
      </div>
    </Modal>
  )
}
