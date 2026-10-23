import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CalendarCheck, CheckCircle2, Eye, GraduationCap, Loader2, Pencil, Phone, Plus, ReceiptText, RefreshCw, Search, UserRound, Users } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { childTypeLabel, getTypeConfig, supportsAttendanceType } from '@/lib/child-pricing'
import { type Child, type ChildTypeConfig, type CreateChildInput, createChild, getChildren, updateChild } from '@/services/apis/children-api'
import { type AttendanceType, getMonthlyAttendances } from '@/services/apis/attendance-api'
import { PLAN_CATEGORIES } from '@/services/apis/plan-api'
import { getTeachers } from '@/services/apis/teachers-api'
import { AttendanceModal } from './attendance-modal'
import { ChildAgeEditor, readChildAges } from './child-age-editor'
import { ChildTypeEditor, readTypeConfigs } from './child-type-editor'

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function formatDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
const defaultAvatar = (gender?: string) =>
  gender === 'female' ? '/avatars/default-girl.svg' : '/avatars/default-boy.svg'

const formatTypes = (value: ChildTypeConfig[]) => value.map((item) => childTypeLabel(item.type)).join(', ') || '—'

const ATTENDANCE_OPTIONS: { type: AttendanceType; label: string }[] = [
  { type: 'THEO_BUOI', label: 'cá nhân' },
  { type: 'CA_NGAY', label: 'cả ngày' },
  { type: 'TAI_NHA', label: 'tại nhà' },
  { type: 'SHADOW', label: 'shadow' },
]

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-muted/60 p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="m-0 mt-1 text-sm font-medium text-text-main">{value || '—'}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold">{label}{children}</label>
}

const inputClass = 'h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary'
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 + 2 }, (_, index) => 2020 + index)

function TypePricingSummary({ configs }: { configs: ChildTypeConfig[] }) {
  return <div className="grid gap-1.5">{configs.map((config) => <div key={config.type} className="text-xs"><strong>{childTypeLabel(config.type)}:</strong> {config.type === 'CA_NGAY'
    ? `${formatMoney(config.prices.tuition)} + CSVC ${formatMoney(config.prices.csvc)} + ăn ${formatMoney(config.prices.meal)}`
    : `${formatMoney(config.price)}/h${config.schedules.length ? ` · GV ${config.schedules.map((schedule) => schedule.teacherName).filter(Boolean).join(', ')}` : ''}`}</div>)}</div>
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | Child['status']>('ALL')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [isCreating, setIsCreating] = useState(false)
  const [detailChild, setDetailChild] = useState<Child | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [attendanceChild, setAttendanceChild] = useState<Child | null>(null)
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('THEO_BUOI')
  const attendanceMonth = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getChildren })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const attendanceStatusQuery = useQuery({
    queryKey: ['attendance-status', attendanceMonth],
    queryFn: () => getMonthlyAttendances(attendanceMonth),
  })
  const completedAttendanceIds = useMemo(
    () => new Set((attendanceStatusQuery.data || []).filter((item) => item.isCompleted).map((item) => item._id)),
    [attendanceStatusQuery.data],
  )
  const createMutation = useMutation({
    mutationFn: createChild,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['children'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] }),
      ])
      setIsCreating(false)
      toast.success('Tạo học sinh thành công')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể tạo học sinh'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Child> }) => updateChild(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['children'] })
      setEditingChild(null)
      toast.success('Cập nhật thông tin trẻ thành công')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật'),
  })

  const filteredChildren = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return (childrenQuery.data || [])
      .filter((child) => statusFilter === 'ALL' || child.status === statusFilter)
      .filter((child) => !keyword || [child.name, child.phone, child.email].join(' ').toLocaleLowerCase('vi').includes(keyword))
      .sort((left, right) => {
        const statusOrder = Number(left.status === 'NGHI_HOC') - Number(right.status === 'NGHI_HOC')
        return statusOrder || left.order - right.order || left.name.localeCompare(right.name, 'vi')
      })
  }, [childrenQuery.data, search, statusFilter])

  const isAttendanceCompleted = (child: Child, type: AttendanceType) =>
    completedAttendanceIds.has(`${attendanceMonth}_${child._id}_${type}`)

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const types = readTypeConfigs(form)
    if (types.length === 0) return toast.error('Vui lòng chọn ít nhất một loại học')
    const gender = String(form.get('gender') || 'male')
    const data: CreateChildInput = {
      order: Math.max(Number(form.get('order')) || 0, 0),
      name: String(form.get('name') || '').trim(),
      gender,
      avatar: defaultAvatar(gender),
      birthDate: String(form.get('birthDate') || '') || null,
      fatherName: String(form.get('fatherName') || '').trim(),
      motherName: String(form.get('motherName') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
      address: String(form.get('address') || '').trim(),
      planLink: String(form.get('planLink') || '').trim(),
      status: String(form.get('status') || 'DANG_HOC') as Child['status'],
      offAt: String(form.get('offAt') || '') || null,
      type: types,
      isInvoice: form.get('isInvoice') === 'on',
      ages: readChildAges(form),
    }
    data.invoiceAmount = Number(form.get('invoiceAmount')) || 0
    createMutation.mutate(data)
  }

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingChild) return
    const form = new FormData(event.currentTarget)
    const data: Partial<Child> = {
      order: Math.max(Number(form.get('order')) || 0, 0),
      name: String(form.get('name') || '').trim(),
      gender: String(form.get('gender') || ''),
      birthDate: String(form.get('birthDate') || '') || null,
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
      fatherName: String(form.get('fatherName') || '').trim(),
      motherName: String(form.get('motherName') || '').trim(),
      address: String(form.get('address') || '').trim(),
      planLink: String(form.get('planLink') || '').trim(),
      status: String(form.get('status') || 'DANG_HOC') as Child['status'],
      offAt: String(form.get('offAt') || '') || null,
      type: readTypeConfigs(form),
      invoiceAmount: Number(form.get('invoiceAmount')) || 0,
      isInvoice: form.get('isInvoice') === 'on',
      ages: readChildAges(form),
    }
    updateMutation.mutate({ id: editingChild._id, data })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Học Sinh" title="Danh sách Trẻ" description="Theo dõi và quản lý thông tin, học phí của trẻ tại trung tâm." />
      <Card>
        <CardHeader title={`Danh sách Trẻ (${filteredChildren.length})`} description="Tìm kiếm theo tên trẻ, số điện thoại hoặc email." action={<div className="flex flex-wrap gap-2"><Button type="button" size="compact" onClick={() => setIsCreating(true)}><Plus size={15} />Tạo học sinh</Button><Button type="button" variant="secondary" size="compact" onClick={() => childrenQuery.refetch()} disabled={childrenQuery.isFetching}><RefreshCw size={15} className={childrenQuery.isFetching ? 'spin' : ''} />Làm mới</Button></div>} />
        <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
          <label className="relative min-w-64 flex-1"><span className="sr-only">Tìm kiếm trẻ</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm trẻ..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-10 pr-4 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Lọc trạng thái" className={inputClass}><option value="ALL">Tất cả trạng thái</option><option value="DANG_HOC">Đang học</option><option value="NGHI_HOC">Đã nghỉ</option></select>
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(Number(event.target.value))} aria-label="Chọn tháng" className={inputClass}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>Tháng {month}</option>)}</select>
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} aria-label="Chọn năm" className={inputClass}>{YEAR_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        </div>

        {childrenQuery.isLoading && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tải danh sách trẻ...</div>}
        {childrenQuery.isError && <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={19} /><div><strong>Không thể tải danh sách trẻ</strong><span className="mt-1 block">{childrenQuery.error instanceof Error ? childrenQuery.error.message : 'Vui lòng thử lại sau.'}</span></div></div>}
        {childrenQuery.isSuccess && filteredChildren.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><Users size={34} className="mx-auto text-muted" /><p className="mb-0 mt-3 font-semibold">Không tìm thấy trẻ</p></div></div>}

        {childrenQuery.isSuccess && filteredChildren.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead className="text-center">Thứ tự</TableHead><TableHead>Trẻ</TableHead><TableHead>Ngày sinh</TableHead><TableHead>Loại học</TableHead><TableHead>Học phí theo loại</TableHead><TableHead>Điểm danh</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{filteredChildren.map((child) => (
              <TableRow key={child._id}>
                <TableCell className="text-center"><input type="number" min="0" step="1" defaultValue={child.order} aria-label={`Thứ tự của ${child.name}`} onBlur={(event) => { const order = Math.max(Number(event.target.value) || 0, 0); if (order !== child.order) updateMutation.mutate({ id: child._id, data: { order } }) }} className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-center text-sm" /></TableCell>
                <TableCell><div className="flex min-w-44 items-center gap-3"><img src={child.avatar || defaultAvatar(child.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child.gender) }} alt={`Ảnh ${child.name}`} className="h-11 w-11 shrink-0 rounded-xl bg-surface-muted object-cover" /><div><strong className="block">{child.name}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${child.status === 'NGHI_HOC' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>{child.status === 'NGHI_HOC' ? 'Đã nghỉ' : 'Đang học'}</span><span className="mt-1 block text-xs text-muted">{child.gender === 'male' ? 'Nam' : child.gender === 'female' ? 'Nữ' : ''}</span>{child.status === 'NGHI_HOC' && <span className="block text-[11px] text-red-600 dark:text-red-300">Nghỉ: {formatDate(child.offAt)}</span>}</div></div></TableCell>
                <TableCell className="whitespace-nowrap text-muted">{formatDate(child.birthDate)}</TableCell>
                <TableCell className="min-w-32">{formatTypes(child.type)}</TableCell>
                <TableCell className="min-w-64"><TypePricingSummary configs={child.type} /></TableCell>
                <TableCell><div className="grid min-w-56 gap-2">{ATTENDANCE_OPTIONS.filter((option) => supportsAttendanceType(child, option.type)).map((option) => <Button key={option.type} type="button" variant="secondary" size="sm" className={isAttendanceCompleted(child, option.type) ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : undefined} onClick={() => { setAttendanceType(option.type); setAttendanceChild(child) }}>{isAttendanceCompleted(child, option.type) ? <CheckCircle2 size={14} /> : <CalendarCheck size={14} />}{isAttendanceCompleted(child, option.type) ? `Đã điểm danh ${option.label}` : `Điểm danh ${option.label}`} T{selectedMonth}/{selectedYear}</Button>)}</div></TableCell>
                <TableCell><div className="ml-auto grid min-w-28 gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setDetailChild(child)}><Eye size={14} />Thông tin</Button><Button type="button" size="sm" onClick={() => setEditingChild(child)}><Pencil size={14} />Chỉnh sửa</Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Card>
      <AttendanceModal child={attendanceChild} initialType={attendanceType} initialMonth={attendanceMonth} onClose={() => setAttendanceChild(null)} />

      <Modal open={isCreating} onClose={() => !createMutation.isPending && setIsCreating(false)} title="Tạo học sinh" description="Thêm thông tin học sinh mới vào trung tâm." className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleCreate} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên"><input name="name" required autoFocus className={inputClass} /></Field>
            <Field label="Giới tính"><select name="gender" defaultValue="male" className={inputClass}><option value="male">Nam</option><option value="female">Nữ</option></select></Field>
            <Field label="Ngày sinh"><input name="birthDate" type="date" className={inputClass} /></Field>
            <Field label="Thứ tự"><input name="order" type="number" min="0" step="1" defaultValue="0" className={inputClass} /></Field>
            <Field label="Trạng thái"><select name="status" defaultValue="DANG_HOC" className={inputClass}><option value="DANG_HOC">Đang học</option><option value="NGHI_HOC">Đã nghỉ</option></select></Field>
            <Field label="Ngày nghỉ học"><input name="offAt" type="date" className={inputClass} /></Field>
            <Field label="Tên bố"><input name="fatherName" className={inputClass} /></Field>
            <Field label="Tên mẹ"><input name="motherName" className={inputClass} /></Field>
            <Field label="Số điện thoại"><input name="phone" type="tel" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
            <Field label="Địa chỉ"><input name="address" className={inputClass} /></Field>
            <Field label="Link kế hoạch"><input name="planLink" type="url" placeholder="https://..." className={inputClass} /></Field>
            <ChildTypeEditor initial={[]} teachers={teachersQuery.data || []} />
            <ChildAgeEditor />
            <Field label="Số tiền hóa đơn"><input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={3240000} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="isInvoice" type="checkbox" />Xuất hóa đơn</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setIsCreating(false)} disabled={createMutation.isPending}>Hủy</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 size={16} className="spin" />}Tạo học sinh</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detailChild)} onClose={() => setDetailChild(null)} title={detailChild?.name || 'Thông tin trẻ'} description="Thông tin cá nhân, lịch học và các khoản phí" className="max-h-[94dvh] max-w-5xl overflow-y-auto">
        {detailChild && <div className="grid gap-4 sm:gap-5">
          <section className="grid gap-4 rounded-2xl border border-border bg-surface-muted/30 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <img src={detailChild.avatar || defaultAvatar(detailChild.gender)} alt="" className="size-12 shrink-0 rounded-full border border-border bg-surface object-cover" />
                <div className="min-w-0"><h3 className="m-0 truncate text-base font-bold">{detailChild.name}</h3><p className="m-0 mt-0.5 text-xs text-muted">ID: {detailChild._id}</p></div>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${detailChild.status === 'NGHI_HOC' ? 'border-danger/30 bg-danger/10 text-danger' : 'border-emerald-400 bg-emerald-50 text-emerald-700'}`}>{detailChild.status === 'NGHI_HOC' ? 'Đã nghỉ' : 'Đang học'}</span>
            </div>
            <dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoItem label="Giới tính" value={detailChild.gender === 'male' ? 'Nam' : 'Nữ'} />
              <InfoItem label="Ngày sinh" value={formatDate(detailChild.birthDate)} />
              <InfoItem label="Thứ tự hiển thị" value={detailChild.order} />
              <InfoItem label="Ngày nghỉ học" value={formatDate(detailChild.offAt)} />
            </dl>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-3 sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info/10 text-info"><Phone size={17} /></span><div><h3 className="m-0 text-sm font-bold">Liên hệ và phụ huynh</h3><p className="m-0 mt-0.5 text-xs text-muted">Thông tin liên hệ của gia đình</p></div></div>
            <dl className="m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Số điện thoại" value={detailChild.phone} />
              <InfoItem label="Email" value={detailChild.email} />
              <InfoItem label="Tên bố" value={detailChild.fatherName} />
              <InfoItem label="Tên mẹ" value={detailChild.motherName} />
              <div className="sm:col-span-2"><InfoItem label="Địa chỉ" value={detailChild.address} /></div>
              <div className="sm:col-span-2 lg:col-span-3"><InfoItem label="Link kế hoạch" value={detailChild.planLink ? <a href={detailChild.planLink} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{detailChild.planLink}</a> : '—'} /></div>
            </dl>
          </section>

          <section className="grid gap-4 rounded-2xl border border-primary/25 bg-primary/[0.035] p-3 sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-primary/15 pb-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap size={19} /></span><div><h3 className="m-0 text-sm font-bold">Loại học và học phí</h3><p className="m-0 mt-0.5 text-xs text-muted">{formatTypes(detailChild.type)}</p></div></div>
            <div className="grid gap-3 lg:grid-cols-2">{detailChild.type.map((config) => <article key={config.type} className="grid gap-3 rounded-xl border border-primary/20 bg-surface p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3"><strong className="text-sm text-primary">{childTypeLabel(config.type)}</strong>{config.type === 'CA_NGAY' ? <span className="text-xs font-semibold text-muted">Theo tháng</span> : config.type === 'SHADOW' ? <span className="text-xs font-semibold text-muted">Tổng theo tháng</span> : <span className="text-xs font-semibold text-muted">Theo giờ</span>}</div>
              <TypePricingSummary configs={[config]} />
              {config.schedules.length > 0 && <div className="grid gap-2 border-t border-border pt-3">{config.schedules.map((schedule, index) => <div key={`${schedule.teacherId}-${index}`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs"><span><strong>{schedule.teacherName || 'Chưa chọn giáo viên'}</strong>{schedule.scheduleInWeek.length ? ` · ${schedule.scheduleInWeek.join(', ')}` : ''}</span><span className="font-semibold text-primary">{formatMoney(schedule.teacherPrice)}{config.type === 'SHADOW' ? '/tháng' : '/h'}</span></div>)}</div>}
            </article>)}</div>
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
            <section className="grid gap-3 rounded-2xl border border-border bg-surface-muted/50 p-3 sm:p-4">
              <div><h3 className="m-0 text-sm font-bold">Độ tuổi theo mục kế hoạch</h3><p className="m-0 mt-0.5 text-xs text-muted">Độ tuổi dùng để chọn nội dung mẫu phù hợp</p></div>
              <div className="grid gap-2 sm:grid-cols-2">{PLAN_CATEGORIES.map((category) => { const configuredAge = detailChild.ages.find((item) => item.id === category.key)?.age; return <div key={category.key} className="flex items-center justify-between gap-3 rounded-xl bg-app-background px-3 py-2.5 text-xs"><span className="min-w-0 truncate" title={category.title}>{category.title}</span><strong className="shrink-0 text-primary">{configuredAge ? `${configuredAge} tuổi` : 'Theo ngày sinh'}</strong></div> })}</div>
            </section>
            <section className="grid gap-3 rounded-2xl border border-border bg-surface-muted/50 p-3 sm:p-4">
              <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning"><ReceiptText size={18} /></span><div><h3 className="m-0 text-sm font-bold">Hóa đơn</h3><p className="m-0 mt-0.5 text-xs text-muted">Thông tin xuất hóa đơn</p></div></div>
              <div className="rounded-xl bg-app-background p-3"><span className="block text-xs text-muted">Trạng thái</span><strong className={detailChild.isInvoice ? 'text-success' : 'text-muted'}>{detailChild.isInvoice ? 'Có xuất hóa đơn' : 'Không xuất hóa đơn'}</strong></div>
              {detailChild.isInvoice && <div className="rounded-xl bg-app-background p-3"><span className="block text-xs text-muted">Số tiền hóa đơn</span><strong className="text-primary">{formatMoney(detailChild.invoiceAmount)}</strong></div>}
            </section>
          </div>
          <div className="flex justify-end border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setDetailChild(null)}>Đóng</Button></div>
        </div>}
      </Modal>

      <Modal open={Boolean(editingChild)} onClose={() => !updateMutation.isPending && setEditingChild(null)} title="Chỉnh sửa thông tin trẻ" description={editingChild?.name} className="max-h-[94dvh] max-w-5xl overflow-y-auto">
        {editingChild && <form onSubmit={handleEdit} className="grid gap-4 sm:gap-5">
          <section className="grid gap-4 rounded-2xl border border-border bg-surface-muted/30 p-3 sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound size={18} /></span>
              <div><h3 className="m-0 text-sm font-bold">Thông tin cơ bản</h3><p className="m-0 mt-0.5 text-xs text-muted">Thông tin nhận diện và trạng thái học của trẻ</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Họ và tên"><input name="name" defaultValue={editingChild.name} required autoFocus className={inputClass} /></Field>
              <Field label="Giới tính"><select name="gender" defaultValue={editingChild.gender} className={inputClass}><option value="male">Nam</option><option value="female">Nữ</option></select></Field>
              <Field label="Ngày sinh"><input name="birthDate" type="date" defaultValue={formatDateInput(editingChild.birthDate)} className={inputClass} /></Field>
              <Field label="Thứ tự hiển thị"><input name="order" type="number" min="0" step="1" defaultValue={editingChild.order} className={inputClass} /></Field>
              <Field label="Trạng thái"><select name="status" defaultValue={editingChild.status} className={inputClass}><option value="DANG_HOC">Đang học</option><option value="NGHI_HOC">Đã nghỉ</option></select></Field>
              <Field label="Ngày nghỉ học"><input name="offAt" type="date" defaultValue={formatDateInput(editingChild.offAt)} className={inputClass} /></Field>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-border bg-surface p-3 sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info/10 text-info"><Phone size={17} /></span>
              <div><h3 className="m-0 text-sm font-bold">Liên hệ và phụ huynh</h3><p className="m-0 mt-0.5 text-xs text-muted">Thông tin liên lạc, gia đình và kế hoạch của trẻ</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Số điện thoại"><input name="phone" type="tel" defaultValue={editingChild.phone} className={inputClass} /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={editingChild.email} className={inputClass} /></Field>
              <Field label="Tên bố"><input name="fatherName" defaultValue={editingChild.fatherName} className={inputClass} /></Field>
              <Field label="Tên mẹ"><input name="motherName" defaultValue={editingChild.motherName} className={inputClass} /></Field>
              <div className="sm:col-span-2"><Field label="Địa chỉ"><input name="address" defaultValue={editingChild.address} className={`${inputClass} w-full`} /></Field></div>
              <div className="sm:col-span-2 lg:col-span-3"><Field label="Link kế hoạch"><input name="planLink" type="url" defaultValue={editingChild.planLink} placeholder="https://..." className={`${inputClass} w-full`} /></Field></div>
            </div>
          </section>

          <section className="grid gap-4 rounded-2xl border border-primary/25 bg-primary/[0.035] p-3 sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-primary/15 pb-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap size={19} /></span>
              <div><h3 className="m-0 text-sm font-bold">Loại học và học phí</h3><p className="m-0 mt-0.5 text-xs text-muted">Chọn loại học, giáo viên, lịch học và mức phí tương ứng</p></div>
            </div>
            <ChildTypeEditor initial={editingChild.type} teachers={teachersQuery.data || []} showTitle={false} />
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
            <ChildAgeEditor initial={editingChild.ages} />
            <section className="grid gap-4 rounded-2xl border border-border bg-surface-muted/50 p-3 sm:p-4">
              <div className="flex items-center gap-2.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning"><ReceiptText size={18} /></span><div><h3 className="m-0 text-sm font-bold">Hóa đơn</h3><p className="m-0 mt-0.5 text-xs text-muted">Thiết lập xuất hóa đơn cho trẻ</p></div></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-app-background p-3 text-sm font-semibold"><input name="isInvoice" type="checkbox" defaultChecked={editingChild.isInvoice} className="size-4" /><span>Xuất hóa đơn</span></label>
              <Field label="Số tiền hóa đơn"><input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={editingChild.invoiceAmount} className={`${inputClass} w-full`} /></Field>
            </section>
          </div>

          <div className="sticky -bottom-5 z-10 -mx-1 flex gap-2 border-t border-border bg-surface/95 px-1 pb-1 pt-4 backdrop-blur sm:justify-end">
            <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setEditingChild(null)} disabled={updateMutation.isPending}>Hủy</Button>
            <Button type="submit" className="flex-1 sm:flex-none" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button>
          </div>
        </form>}
      </Modal>
    </div>
  )
}
