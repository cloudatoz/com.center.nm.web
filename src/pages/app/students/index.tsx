import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CalendarCheck, CheckCircle2, Eye, Loader2, Pencil, Plus, RefreshCw, Search, Users } from 'lucide-react'
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
import { getTeachers } from '@/services/apis/teachers-api'
import { AttendanceModal } from './attendance-modal'
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
const CURRENT_MONTH_SHORT = `T${new Date().getMonth() + 1}`
const CURRENT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

function TypePricingSummary({ configs }: { configs: ChildTypeConfig[] }) {
  return <div className="grid gap-1.5">{configs.map((config) => <div key={config.type} className="text-xs"><strong>{childTypeLabel(config.type)}:</strong> {config.type === 'CA_NGAY'
    ? `${formatMoney(config.prices.tuition)} + CSVC ${formatMoney(config.prices.csvc)} + ăn ${formatMoney(config.prices.meal)}`
    : `${formatMoney(config.price)}/h${config.teacherName ? ` · GV ${config.teacherName}` : ''}`}</div>)}</div>
}

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [detailChild, setDetailChild] = useState<Child | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [attendanceChild, setAttendanceChild] = useState<Child | null>(null)
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('THEO_BUOI')
  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getChildren })
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const attendanceStatusQuery = useQuery({
    queryKey: ['attendance-status', CURRENT_MONTH],
    queryFn: () => getMonthlyAttendances(CURRENT_MONTH),
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
    if (!keyword) return childrenQuery.data || []
    return (childrenQuery.data || []).filter((child) =>
      [child.name, child.phone, child.email].join(' ').toLocaleLowerCase('vi').includes(keyword),
    )
  }, [childrenQuery.data, search])

  const isAttendanceCompleted = (child: Child, type: AttendanceType) =>
    completedAttendanceIds.has(`${CURRENT_MONTH}_${child._id}_${type}`)

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
      type: types,
      isInvoice: form.get('isInvoice') === 'on',
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
      planLink: String(form.get('planLink') || '').trim(),
      type: readTypeConfigs(form),
      invoiceAmount: Number(form.get('invoiceAmount')) || 0,
    }
    updateMutation.mutate({ id: editingChild._id, data })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Học Sinh" title="Danh sách Trẻ" description="Theo dõi và quản lý thông tin, học phí của trẻ tại trung tâm." />
      <Card>
        <CardHeader title={`Danh sách Trẻ (${filteredChildren.length})`} description="Tìm kiếm theo tên trẻ, số điện thoại hoặc email." action={<div className="flex flex-wrap gap-2"><Button type="button" size="compact" onClick={() => setIsCreating(true)}><Plus size={15} />Tạo học sinh</Button><Button type="button" variant="secondary" size="compact" onClick={() => childrenQuery.refetch()} disabled={childrenQuery.isFetching}><RefreshCw size={15} className={childrenQuery.isFetching ? 'spin' : ''} />Làm mới</Button></div>} />
        <div className="border-b border-border p-4 sm:px-6">
          <label className="relative block max-w-md"><span className="sr-only">Tìm kiếm trẻ</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm trẻ..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-10 pr-4 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
        </div>

        {childrenQuery.isLoading && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tải danh sách trẻ...</div>}
        {childrenQuery.isError && <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={19} /><div><strong>Không thể tải danh sách trẻ</strong><span className="mt-1 block">{childrenQuery.error instanceof Error ? childrenQuery.error.message : 'Vui lòng thử lại sau.'}</span></div></div>}
        {childrenQuery.isSuccess && filteredChildren.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><Users size={34} className="mx-auto text-muted" /><p className="mb-0 mt-3 font-semibold">Không tìm thấy trẻ</p></div></div>}

        {childrenQuery.isSuccess && filteredChildren.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Trẻ</TableHead><TableHead>Ngày sinh</TableHead><TableHead>Loại học</TableHead><TableHead>Học phí theo loại</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{filteredChildren.map((child) => (
              <TableRow key={child._id}>
                <TableCell><div className="flex min-w-44 items-center gap-3"><img src={child.avatar || defaultAvatar(child.gender)} onError={(event) => { event.currentTarget.src = defaultAvatar(child.gender) }} alt={`Ảnh ${child.name}`} className="h-11 w-11 shrink-0 rounded-xl bg-surface-muted object-cover" /><div><strong className="block">{child.name}</strong><span className="inline-flex items-center gap-1 text-xs text-muted">Thứ tự <input type="number" min="0" step="1" defaultValue={child.order} aria-label={`Thứ tự của ${child.name}`} onBlur={(event) => { const order = Math.max(Number(event.target.value) || 0, 0); if (order !== child.order) updateMutation.mutate({ id: child._id, data: { order } }) }} className="h-6 w-14 rounded-md border border-border bg-surface px-1.5 text-center text-xs" /> · {child.gender === 'male' ? 'Nam' : child.gender === 'female' ? 'Nữ' : ''}</span></div></div></TableCell>
                <TableCell className="whitespace-nowrap text-muted">{formatDate(child.birthDate)}</TableCell>
                <TableCell className="min-w-32">{formatTypes(child.type)}</TableCell>
                <TableCell className="min-w-64"><TypePricingSummary configs={child.type} /></TableCell>
                <TableCell><div className="ml-auto grid min-w-56 gap-2">{ATTENDANCE_OPTIONS.filter((option) => supportsAttendanceType(child, option.type)).map((option) => <Button key={option.type} type="button" variant="secondary" size="sm" className={isAttendanceCompleted(child, option.type) ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : undefined} onClick={() => { setAttendanceType(option.type); setAttendanceChild(child) }}>{isAttendanceCompleted(child, option.type) ? <CheckCircle2 size={14} /> : <CalendarCheck size={14} />}{isAttendanceCompleted(child, option.type) ? `Đã điểm danh ${option.label}` : `Điểm danh ${option.label}`} {CURRENT_MONTH_SHORT}</Button>)}<Button type="button" variant="secondary" size="sm" onClick={() => setDetailChild(child)}><Eye size={14} />Thông tin</Button><Button type="button" size="sm" onClick={() => setEditingChild(child)}><Pencil size={14} />Chỉnh sửa</Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Card>
      <AttendanceModal child={attendanceChild} initialType={attendanceType} onClose={() => setAttendanceChild(null)} />

      <Modal open={isCreating} onClose={() => !createMutation.isPending && setIsCreating(false)} title="Tạo học sinh" description="Thêm thông tin học sinh mới vào trung tâm." className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleCreate} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên"><input name="name" required autoFocus className={inputClass} /></Field>
            <Field label="Giới tính"><select name="gender" defaultValue="male" className={inputClass}><option value="male">Nam</option><option value="female">Nữ</option></select></Field>
            <Field label="Ngày sinh"><input name="birthDate" type="date" className={inputClass} /></Field>
            <Field label="Thứ tự"><input name="order" type="number" min="0" step="1" defaultValue="0" className={inputClass} /></Field>
            <Field label="Tên bố"><input name="fatherName" className={inputClass} /></Field>
            <Field label="Tên mẹ"><input name="motherName" className={inputClass} /></Field>
            <Field label="Số điện thoại"><input name="phone" type="tel" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
            <Field label="Địa chỉ"><input name="address" className={inputClass} /></Field>
            <Field label="Link kế hoạch"><input name="planLink" type="url" placeholder="https://..." className={inputClass} /></Field>
            <ChildTypeEditor initial={[]} teachers={teachersQuery.data || []} />
            <Field label="Số tiền hóa đơn"><input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={3240000} className={inputClass} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input name="isInvoice" type="checkbox" />Xuất hóa đơn</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setIsCreating(false)} disabled={createMutation.isPending}>Hủy</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 size={16} className="spin" />}Tạo học sinh</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detailChild)} onClose={() => setDetailChild(null)} title={detailChild?.name || 'Thông tin trẻ'} description="Thông tin cá nhân và các khoản phí" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {detailChild && <div className="grid gap-5"><dl className="m-0 grid gap-3 sm:grid-cols-2"><InfoItem label="Ngày sinh" value={formatDate(detailChild.birthDate)} /><InfoItem label="Giới tính" value={detailChild.gender === 'male' ? 'Nam' : 'Nữ'} /><InfoItem label="Loại học" value={formatTypes(detailChild.type)} /><InfoItem label="Liên hệ" value={detailChild.phone || detailChild.email} /><InfoItem label="Tên bố" value={detailChild.fatherName} /><InfoItem label="Tên mẹ" value={detailChild.motherName} /><InfoItem label="Địa chỉ" value={detailChild.address} /><InfoItem label="Link kế hoạch" value={detailChild.planLink} /><InfoItem label="Xuất hóa đơn" value={detailChild.isInvoice ? 'Có' : 'Không'} /></dl><div><h4 className="mb-3 mt-0 text-sm font-bold">Học phí theo loại</h4><TypePricingSummary configs={detailChild.type} /></div></div>}
      </Modal>

      <Modal open={Boolean(editingChild)} onClose={() => !updateMutation.isPending && setEditingChild(null)} title="Chỉnh sửa thông tin" description={editingChild?.name} className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editingChild && <form onSubmit={handleEdit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Họ và tên"><input name="name" defaultValue={editingChild.name} required className={inputClass} /></Field><Field label="Giới tính"><select name="gender" defaultValue={editingChild.gender} className={inputClass}><option value="male">Nam</option><option value="female">Nữ</option></select></Field><Field label="Ngày sinh"><input name="birthDate" type="date" defaultValue={formatDateInput(editingChild.birthDate)} className={inputClass} /></Field><Field label="Số điện thoại"><input name="phone" defaultValue={editingChild.phone} className={inputClass} /></Field><Field label="Email"><input name="email" type="email" defaultValue={editingChild.email} className={inputClass} /></Field><Field label="Link kế hoạch"><input name="planLink" type="url" defaultValue={editingChild.planLink} placeholder="https://..." className={inputClass} /></Field><ChildTypeEditor initial={editingChild.type} teachers={teachersQuery.data || []} /><Field label="Số tiền hóa đơn"><input name="invoiceAmount" type="number" min="0" step="1000" defaultValue={editingChild.invoiceAmount} className={inputClass} /></Field></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setEditingChild(null)} disabled={updateMutation.isPending}>Hủy</Button><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div></form>}
      </Modal>
    </div>
  )
}
