import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CalendarCheck, CheckCircle2, Eye, Loader2, Pencil, RefreshCw, Search, Users } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type Child, getChildren, updateChild } from '@/services/apis/children-api'
import { type AttendanceType, getMonthlyAttendances } from '@/services/apis/attendance-api'
import { AttendanceModal } from './attendance-modal'

const TYPE_LABELS: Record<string, string> = {
  BAN_TRU: 'Bán trú', CA_NHAN: 'Cá nhân', TAI_NHA: 'Tại nhà', TIEU_HOC: 'Tiểu học', TRE_MAM_NON: 'Trẻ mầm non',
}

const FEE_FIELDS = [
  ['tuitionFee', 'Học phí'], ['mealFee', 'Tiền ăn'], ['csvcFee', 'Phí CSVC'],
  ['drawingFee', 'Phí vẽ'], ['languageFee', 'Phí ngoại ngữ'],
  ['movementFee', 'Phí vận động'], ['invoiceAmount', 'Số tiền hóa đơn'],
] as const

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

function formatTypes(value: string | string[]) {
  const types = Array.isArray(value) ? value : [value]
  return types.map((type) => TYPE_LABELS[type] || type).join(', ') || '—'
}

function supportsAttendanceType(child: Child, attendanceType: AttendanceType) {
  const types = Array.isArray(child.type) ? child.type : [child.type]
  if (attendanceType === 'BAN_TRU') return types.includes('BAN_TRU')
  return types.length === 0 || types.some((type) => type !== 'BAN_TRU')
}

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

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [detailChild, setDetailChild] = useState<Child | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [attendanceChild, setAttendanceChild] = useState<Child | null>(null)
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('THEO_BUOI')
  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getChildren })
  const attendanceStatusQuery = useQuery({
    queryKey: ['attendance-status', CURRENT_MONTH],
    queryFn: () => getMonthlyAttendances(CURRENT_MONTH),
  })
  const completedAttendanceIds = useMemo(
    () => new Set((attendanceStatusQuery.data || []).filter((item) => item.isCompleted).map((item) => item._id)),
    [attendanceStatusQuery.data],
  )
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

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingChild) return
    const form = new FormData(event.currentTarget)
    const data: Partial<Child> = {
      name: String(form.get('name') || '').trim(),
      gender: String(form.get('gender') || ''),
      birthDate: String(form.get('birthDate') || '') || null,
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
    }
    for (const [field] of FEE_FIELDS) data[field] = Number(form.get(field)) || 0
    updateMutation.mutate({ id: editingChild._id, data })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Học Sinh" title="Danh sách Trẻ" description="Theo dõi và quản lý thông tin, học phí của trẻ tại trung tâm." />
      <Card>
        <CardHeader title={`Danh sách Trẻ (${filteredChildren.length})`} description="Tìm kiếm theo tên trẻ, số điện thoại hoặc email." action={
          <Button type="button" variant="secondary" size="compact" onClick={() => childrenQuery.refetch()} disabled={childrenQuery.isFetching}>
            <RefreshCw size={15} className={childrenQuery.isFetching ? 'spin' : ''} />Làm mới
          </Button>
        } />
        <div className="border-b border-border p-4 sm:px-6">
          <label className="relative block max-w-md"><span className="sr-only">Tìm kiếm trẻ</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm trẻ..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-10 pr-4 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
        </div>

        {childrenQuery.isLoading && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tải danh sách trẻ...</div>}
        {childrenQuery.isError && <div className="m-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={19} /><div><strong>Không thể tải danh sách trẻ</strong><span className="mt-1 block">{childrenQuery.error instanceof Error ? childrenQuery.error.message : 'Vui lòng thử lại sau.'}</span></div></div>}
        {childrenQuery.isSuccess && filteredChildren.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><Users size={34} className="mx-auto text-muted" /><p className="mb-0 mt-3 font-semibold">Không tìm thấy trẻ</p></div></div>}

        {childrenQuery.isSuccess && filteredChildren.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Trẻ</TableHead><TableHead>Ngày sinh</TableHead><TableHead>Loại học</TableHead><TableHead>Học phí</TableHead><TableHead>Tiền ăn</TableHead><TableHead>Phí khác</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{filteredChildren.map((child) => (
              <TableRow key={child._id}>
                <TableCell><div className="flex min-w-44 items-center gap-3">{child.avatar ? <img src={child.avatar} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 font-bold text-primary">{child.name.charAt(0).toUpperCase()}</span>}<div><strong className="block">{child.name}</strong><span className="text-xs text-muted">{child.gender === 'male' ? 'Nam' : child.gender === 'female' ? 'Nữ' : ''}</span></div></div></TableCell>
                <TableCell className="whitespace-nowrap text-muted">{formatDate(child.birthDate)}</TableCell>
                <TableCell className="min-w-32">{formatTypes(child.type)}</TableCell>
                <TableCell className="whitespace-nowrap font-medium">{formatMoney(child.tuitionFee)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatMoney(child.mealFee)}</TableCell>
                <TableCell className="min-w-36 text-xs text-muted"><span className="block">CSVC: {formatMoney(child.csvcFee)}</span><span className="mt-1 block">Vẽ: {formatMoney(child.drawingFee)}</span><span className="mt-1 block">Ngoại ngữ: {formatMoney(child.languageFee)}</span><span className="mt-1 block">Vận động: {formatMoney(child.movementFee)}</span></TableCell>
                <TableCell><div className="flex min-w-max justify-end gap-2">{supportsAttendanceType(child, 'THEO_BUOI') && <Button type="button" variant="secondary" size="sm" className={isAttendanceCompleted(child, 'THEO_BUOI') ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : undefined} onClick={() => { setAttendanceType('THEO_BUOI'); setAttendanceChild(child) }}>{isAttendanceCompleted(child, 'THEO_BUOI') ? <CheckCircle2 size={14} /> : <CalendarCheck size={14} />}{isAttendanceCompleted(child, 'THEO_BUOI') ? 'Đã điểm danh theo buổi' : 'Điểm danh theo buổi'} {CURRENT_MONTH_SHORT}</Button>}{supportsAttendanceType(child, 'BAN_TRU') && <Button type="button" variant="secondary" size="sm" className={isAttendanceCompleted(child, 'BAN_TRU') ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300' : undefined} onClick={() => { setAttendanceType('BAN_TRU'); setAttendanceChild(child) }}>{isAttendanceCompleted(child, 'BAN_TRU') ? <CheckCircle2 size={14} /> : <CalendarCheck size={14} />}{isAttendanceCompleted(child, 'BAN_TRU') ? 'Đã điểm danh bán trú' : 'Điểm danh bán trú'} {CURRENT_MONTH_SHORT}</Button>}<Button type="button" variant="secondary" size="sm" onClick={() => setDetailChild(child)}><Eye size={14} />Thông tin</Button><Button type="button" size="sm" onClick={() => setEditingChild(child)}><Pencil size={14} />Chỉnh sửa</Button></div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Card>
      <AttendanceModal child={attendanceChild} initialType={attendanceType} onClose={() => setAttendanceChild(null)} />

      <Modal open={Boolean(detailChild)} onClose={() => setDetailChild(null)} title={detailChild?.name || 'Thông tin trẻ'} description="Thông tin cá nhân và các khoản phí" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {detailChild && <div className="grid gap-5"><dl className="m-0 grid gap-3 sm:grid-cols-2"><InfoItem label="Ngày sinh" value={formatDate(detailChild.birthDate)} /><InfoItem label="Giới tính" value={detailChild.gender === 'male' ? 'Nam' : 'Nữ'} /><InfoItem label="Loại học" value={formatTypes(detailChild.type)} /><InfoItem label="Liên hệ" value={detailChild.phone || detailChild.email} /><InfoItem label="Tên bố" value={detailChild.fatherName} /><InfoItem label="Tên mẹ" value={detailChild.motherName} /><InfoItem label="Địa chỉ" value={detailChild.address} /><InfoItem label="Xuất hóa đơn" value={detailChild.isInvoice ? 'Có' : 'Không'} /></dl><div><h4 className="mb-3 mt-0 text-sm font-bold">Các khoản phí</h4><dl className="m-0 grid gap-3 sm:grid-cols-2">{FEE_FIELDS.map(([field, label]) => <InfoItem key={field} label={label} value={formatMoney(detailChild[field])} />)}<InfoItem label="Mức phí theo giờ" value={formatMoney(detailChild.salaryOneHourForCenter)} /></dl></div></div>}
      </Modal>

      <Modal open={Boolean(editingChild)} onClose={() => !updateMutation.isPending && setEditingChild(null)} title="Chỉnh sửa thông tin" description={editingChild?.name} className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editingChild && <form onSubmit={handleEdit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Họ và tên"><input name="name" defaultValue={editingChild.name} required className={inputClass} /></Field><Field label="Giới tính"><select name="gender" defaultValue={editingChild.gender} className={inputClass}><option value="male">Nam</option><option value="female">Nữ</option></select></Field><Field label="Ngày sinh"><input name="birthDate" type="date" defaultValue={formatDateInput(editingChild.birthDate)} className={inputClass} /></Field><Field label="Số điện thoại"><input name="phone" defaultValue={editingChild.phone} className={inputClass} /></Field><div className="sm:col-span-2"><Field label="Email"><input name="email" type="email" defaultValue={editingChild.email} className={inputClass} /></Field></div></div><div><h4 className="mb-3 mt-0 text-sm font-bold">Các khoản phí</h4><div className="grid gap-4 sm:grid-cols-2">{FEE_FIELDS.map(([field, label]) => <Field key={field} label={label}><input name={field} type="number" min="0" step="1000" defaultValue={editingChild[field]} className={inputClass} /></Field>)}</div></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setEditingChild(null)} disabled={updateMutation.isPending}>Hủy</Button><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div></form>}
      </Modal>
    </div>
  )
}
