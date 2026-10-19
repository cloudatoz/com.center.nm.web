import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Eye, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VIETNAM_BANKS } from '@/constants/vietnam-banks'
import { createTeacher, deleteTeacher, getTeachers, type Teacher, updateTeacher } from '@/services/apis/teachers-api'

const inputClass = 'h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary'
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
type TeacherType = Teacher['type'][number]
const teacherTypeLabel = (type: TeacherType) => ({ CA_NGAY: 'Cả ngày', THEO_BUOI: 'Theo buổi', CA_NHAN: 'Trung tâm', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow', ASSISTANT: 'Trợ lý', BEP: 'Bếp' })[type]
const teacherTypeOptions: Array<{ value: TeacherType; label: string }> = [
  { value: 'CA_NGAY', label: 'Cả ngày' }, { value: 'THEO_BUOI', label: 'Theo buổi' },
  { value: 'CA_NHAN', label: 'Trung tâm' }, { value: 'TAI_NHA', label: 'Tại nhà' }, { value: 'SHADOW', label: 'Shadow' }, { value: 'ASSISTANT', label: 'Trợ lý' }, { value: 'BEP', label: 'Bếp' },
]

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`grid min-w-0 gap-1.5 text-sm font-semibold ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

function InfoItem({ label, value, wide }: { label: string; value?: React.ReactNode; wide?: boolean }) {
  return <div className={`rounded-xl bg-surface-muted/60 p-3 ${wide ? 'sm:col-span-2' : ''}`}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="m-0 mt-1 text-sm font-medium text-text-main">{value || '—'}</dd></div>
}

function TeacherTypeCheckboxes({ initial = ['THEO_BUOI'] }: { initial?: Teacher['type'] }) {
  return <fieldset className="grid gap-2 sm:col-span-2"><legend className="mb-1 text-sm font-semibold">Loại giáo viên</legend><div className="flex flex-wrap gap-2">{teacherTypeOptions.map((option) => <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-app-background px-3 py-2 text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"><input name="type" type="checkbox" value={option.value} defaultChecked={initial.includes(option.value)} className="h-4 w-4 accent-primary" />{option.label}</label>)}</div></fieldset>
}

function BankInfo({ name }: { name?: string }) {
  const bank = VIETNAM_BANKS.find((item) => item.shortName.toLocaleLowerCase() === name?.toLocaleLowerCase() || item.code.toLocaleLowerCase() === name?.toLocaleLowerCase())
  if (!bank) return <>{name || '—'}</>
  return <span className="flex min-w-0 items-center gap-2"><img src={bank.logo} alt={`Logo ${bank.shortName}`} className="h-7 w-14 shrink-0 object-contain" /><span className="truncate">{bank.shortName} · {bank.code}</span></span>
}

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [detailTeacher, setDetailTeacher] = useState<Teacher | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [selectedBankCode, setSelectedBankCode] = useState('')
  const [bankSearch, setBankSearch] = useState('')
  const [bankSearchOpen, setBankSearchOpen] = useState(false)
  const selectedBank = VIETNAM_BANKS.find((bank) => bank.code === selectedBankCode)
  const filteredBanks = useMemo(() => {
    const keyword = bankSearch.trim().toLocaleLowerCase('vi')
    if (!keyword || selectedBank?.shortName === bankSearch) return VIETNAM_BANKS
    return VIETNAM_BANKS.filter((bank) => [bank.shortName, bank.code, bank.name].join(' ').toLocaleLowerCase('vi').includes(keyword))
  }, [bankSearch, selectedBank])
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Teacher> }) => updateTeacher(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      await queryClient.invalidateQueries({ queryKey: ['salary-month'] })
      setEditingTeacher(null)
      toast.success('Cập nhật giáo viên thành công')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật'),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      toast.success('Đã chuyển giáo viên sang trạng thái ngừng hoạt động')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể xóa giáo viên'),
  })
  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teachers'] })
      setCreatingTeacher(false)
      setSelectedBankCode('')
      setBankSearch('')
      toast.success('Tạo giáo viên thành công')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể tạo giáo viên'),
  })

  const filteredTeachers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return teachersQuery.data || []
    return (teachersQuery.data || []).filter((teacher) =>
      [teacher.name, teacher.account, teacher.email, teacher.phone]
        .join(' ').toLocaleLowerCase('vi').includes(keyword),
    )
  }, [search, teachersQuery.data])

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTeacher) return
    const form = new FormData(event.currentTarget)
    const types = form.getAll('type').map(String) as Teacher['type']
    if (!types.length) return toast.error('Vui lòng chọn ít nhất một loại giáo viên')
    updateMutation.mutate({
      id: editingTeacher._id,
      data: {
        order: Math.max(Number(form.get('order')) || 0, 0),
        name: String(form.get('name') || '').trim(),
        account: String(form.get('account') || '').trim(),
        email: String(form.get('email') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        address: String(form.get('address') || '').trim(),
        description: String(form.get('description') || '').trim(),
        otherSalary: Number(form.get('otherSalary')) || 0,
        type: types,
        baseSalary: Number(form.get('baseSalary')) || 0,
        insuranceSupport: Number(form.get('insuranceSupport')) || 0,
        isPayInsurance: form.get('isPayInsurance') === 'on',
        attendanceBonus: Number(form.get('attendanceBonus')) || 0,
        sessionsPerDay: Number(form.get('sessionsPerDay')) || 0,
        isSalaryByMonth: form.get('isSalaryByMonth') === 'on',
        accountBank: String(form.get('accountBank') || '').trim(),
        nameBank: VIETNAM_BANKS.find((bank) => bank.code === String(form.get('bankCode') || ''))?.shortName || editingTeacher.nameBank,
      },
    })
  }

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const types = form.getAll('type').map(String) as Teacher['type']
    if (!types.length) return toast.error('Vui lòng chọn ít nhất một loại giáo viên')
    createMutation.mutate({
      order: Math.max(Number(form.get('order')) || 9999, 0),
      name: String(form.get('name') || '').trim(),
      type: types,
      account: String(form.get('account') || '').trim(),
      password: String(form.get('password') || ''),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      address: String(form.get('address') || '').trim(),
      description: String(form.get('description') || '').trim(),
      baseSalary: Number(form.get('baseSalary')) || 0,
      insuranceSupport: Number(form.get('insuranceSupport')) || 0,
      isPayInsurance: form.get('isPayInsurance') === 'on',
      attendanceBonus: Number(form.get('attendanceBonus')) || 0,
      otherSalary: Number(form.get('otherSalary')) || 0,
      sessionsPerDay: Number(form.get('sessionsPerDay')) || 0,
      isSalaryByMonth: form.get('isSalaryByMonth') === 'on',
      accountBank: String(form.get('accountBank') || '').trim(),
      nameBank: VIETNAM_BANKS.find((bank) => bank.code === String(form.get('bankCode') || ''))?.shortName || '',
    })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Giáo Viên" title="Danh sách Giáo Viên" description="Theo dõi và quản lý hồ sơ, thông tin lương của giáo viên." />
      <Card>
        <CardHeader title={`Danh sách Giáo Viên (${filteredTeachers.length})`} description="Tìm kiếm theo tên, tài khoản, email hoặc số điện thoại." action={<div className="flex gap-2"><Button type="button" size="compact" onClick={() => setCreatingTeacher(true)}><Plus size={15} />Tạo mới</Button><Button type="button" variant="secondary" size="compact" onClick={() => teachersQuery.refetch()} disabled={teachersQuery.isFetching}><RefreshCw size={15} className={teachersQuery.isFetching ? 'spin' : ''} />Làm mới</Button></div>} />
        <div className="border-b border-border p-4 sm:px-6"><label className="relative block max-w-md"><span className="sr-only">Tìm kiếm giáo viên</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm giáo viên..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label></div>

        {teachersQuery.isLoading && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tải danh sách giáo viên...</div>}
        {teachersQuery.isError && <div className="m-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={19} /><div><strong>Không thể tải danh sách giáo viên</strong><span className="mt-1 block">{teachersQuery.error instanceof Error ? teachersQuery.error.message : 'Vui lòng thử lại sau.'}</span></div></div>}
        {teachersQuery.isSuccess && filteredTeachers.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><Users size={34} className="mx-auto text-muted" /><p className="mb-0 mt-3 font-semibold">Không tìm thấy giáo viên</p></div></div>}

        {teachersQuery.isSuccess && filteredTeachers.length > 0 && <Table>
          <TableHeader><TableRow><TableHead className="text-center">Thứ tự</TableHead><TableHead>Giáo viên</TableHead><TableHead>Loại</TableHead><TableHead>Lương cơ bản</TableHead><TableHead>Hỗ trợ bảo hiểm</TableHead><TableHead>Chuyên cần</TableHead><TableHead>Tổng lương</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>{filteredTeachers.map((teacher) => <TableRow key={teacher._id}>
            <TableCell className="text-center font-semibold text-muted">{teacher.order}</TableCell>
            <TableCell><div className="flex min-w-44 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary">{teacher.name.charAt(0).toUpperCase()}</span><div><strong className="block">{teacher.name}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${teacher.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>{teacher.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></div></div></TableCell>
            <TableCell><div className="flex min-w-32 flex-wrap gap-1">{teacher.type.map((type) => <span key={type} className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${type === 'CA_NGAY' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{teacherTypeLabel(type)}</span>)}{teacher.sessionsPerDay > 0 && <span className="text-[10px] text-muted">{teacher.sessionsPerDay} buổi/ngày</span>}</div></TableCell>
            <TableCell className="whitespace-nowrap font-medium">{formatMoney(teacher.baseSalary)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatMoney(teacher.insuranceSupport)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatMoney(teacher.attendanceBonus)}</TableCell>
            <TableCell className="whitespace-nowrap font-bold text-primary">{formatMoney(teacher.baseSalary + teacher.insuranceSupport + teacher.attendanceBonus + teacher.otherSalary)}</TableCell>
            <TableCell><div className="flex min-w-64 justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setDetailTeacher(teacher)}><Eye size={14} />Thông tin</Button><Button type="button" size="sm" onClick={() => setEditingTeacher(teacher)}><Pencil size={14} />Chỉnh sửa</Button>{teacher.active && <Button type="button" variant="danger" size="sm" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Xóa giáo viên “${teacher.name}”? Giáo viên sẽ chuyển sang trạng thái ngừng hoạt động.`)) deleteMutation.mutate(teacher._id) }}><Trash2 size={14} />Xóa</Button>}</div></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      </Card>

      <Modal open={creatingTeacher} onClose={() => { if (!createMutation.isPending) { setCreatingTeacher(false); setSelectedBankCode(''); setBankSearch('') } }} title="Tạo giáo viên mới" description="Nhập hồ sơ và thông tin lương" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <form onSubmit={handleCreate} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên"><input name="name" required className={inputClass} /></Field>
            <Field label="Thứ tự"><input name="order" type="number" min="0" step="1" defaultValue="9999" className={inputClass} /></Field>
            <TeacherTypeCheckboxes />
            <Field label="Tài khoản đăng nhập"><input name="account" required autoComplete="off" className={inputClass} /></Field>
            <Field label="Mật khẩu"><input name="password" type="password" required minLength={6} autoComplete="new-password" className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" required className={inputClass} /></Field>
            <Field label="Số điện thoại"><input name="phone" required className={inputClass} /></Field>
            <Field label="Địa chỉ" wide><input name="address" required className={inputClass} /></Field>
            <Field label="Lương cơ bản"><input name="baseSalary" type="number" min="0" step="1000" defaultValue="0" className={inputClass} /></Field>
            <Field label="Hỗ trợ bảo hiểm"><input name="insuranceSupport" type="number" min="0" step="1000" defaultValue="0" className={inputClass} /></Field>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isPayInsurance" type="checkbox" className="h-4 w-4 accent-primary" />Có đóng bảo hiểm</label>
            <Field label="Chuyên cần"><input name="attendanceBonus" type="number" min="0" step="1000" defaultValue="0" className={inputClass} /></Field>
            <Field label="Lương khác"><input name="otherSalary" type="number" min="0" step="1000" defaultValue="0" className={inputClass} /></Field>
            <Field label="Số buổi/ngày"><input name="sessionsPerDay" type="number" min="0" step="1" defaultValue="0" className={inputClass} /></Field>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isSalaryByMonth" type="checkbox" className="h-4 w-4 accent-primary" />Trả lương cố định theo tháng</label>
            <Field label="Mô tả" wide><input name="description" className={inputClass} /></Field>
          </div>
          <section className="grid gap-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Thông tin ngân hàng</h4>
              <p className="mb-0 mt-1 text-xs text-slate-500 dark:text-slate-400">Tài khoản dùng để nhận lương của giáo viên</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ngân hàng"><div className="relative"><input type="hidden" name="bankCode" value={selectedBankCode} /><div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={bankSearch} placeholder="Tìm tên hoặc mã ngân hàng" autoComplete="off" className={`${inputClass} w-full min-w-0 pl-9`} onFocus={() => setBankSearchOpen(true)} onBlur={() => window.setTimeout(() => setBankSearchOpen(false), 150)} onChange={(event) => { setBankSearch(event.target.value); setSelectedBankCode(''); setBankSearchOpen(true) }} /></div>{bankSearchOpen && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-white p-1 shadow-xl dark:bg-app-background">{filteredBanks.length ? filteredBanks.map((bank) => <button key={bank.code} type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-muted" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedBankCode(bank.code); setBankSearch(bank.shortName); setBankSearchOpen(false) }}><img src={bank.logo} alt="" className="h-7 w-14 shrink-0 object-contain" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{bank.shortName} · {bank.code}</span><span className="block truncate text-xs font-normal text-muted">{bank.name}</span></span></button>) : <p className="m-0 px-3 py-4 text-center text-sm font-normal text-muted">Không tìm thấy ngân hàng</p>}</div>}</div>{selectedBank && <span className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-medium text-slate-700"><img src={selectedBank.logo} alt={`Logo ${selectedBank.shortName}`} className="h-7 w-16 shrink-0 object-contain" /><span className="min-w-0 truncate">{selectedBank.shortName} · {selectedBank.code}</span></span>}</Field>
              <Field label="Số tài khoản"><input name="accountBank" className={inputClass} /></Field>
            </div>
          </section>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => { setCreatingTeacher(false); setSelectedBankCode(''); setBankSearch('') }} disabled={createMutation.isPending}>Hủy</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending && <Loader2 size={16} className="spin" />}Tạo giáo viên</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detailTeacher)} onClose={() => setDetailTeacher(null)} title={detailTeacher?.name || 'Thông tin giáo viên'} description="Hồ sơ và thông tin lương" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {detailTeacher && <dl className="m-0 grid gap-3 sm:grid-cols-2"><InfoItem label="Loại giáo viên" value={detailTeacher.type.map(teacherTypeLabel).join(' · ')} /><InfoItem label="Số buổi/ngày" value={detailTeacher.sessionsPerDay || '—'} /><InfoItem label="Lương cơ bản" value={formatMoney(detailTeacher.baseSalary)} /><InfoItem label="Hỗ trợ bảo hiểm" value={formatMoney(detailTeacher.insuranceSupport)} /><InfoItem label="Trạng thái bảo hiểm" value={detailTeacher.isPayInsurance ? `Có đóng bảo hiểm` : `Không đóng bảo hiểm`} /><InfoItem label="Chuyên cần" value={formatMoney(detailTeacher.attendanceBonus)} /><InfoItem label="Lương khác" value={formatMoney(detailTeacher.otherSalary)} /><InfoItem label="Tài khoản" value={detailTeacher.account} /><InfoItem label="Email" value={detailTeacher.email} /><InfoItem label="Số điện thoại" value={detailTeacher.phone} /><InfoItem label="Tổng lương" value={formatMoney(detailTeacher.baseSalary + detailTeacher.insuranceSupport + detailTeacher.attendanceBonus + detailTeacher.otherSalary)} /><InfoItem label="Ngân hàng" value={<BankInfo name={detailTeacher.nameBank} />} /><InfoItem label="Số tài khoản" value={detailTeacher.accountBank} /><InfoItem label="Địa chỉ" value={detailTeacher.address} wide /><InfoItem label="Mô tả" value={detailTeacher.description} wide /></dl>}
      </Modal>

      <Modal open={Boolean(editingTeacher)} onClose={() => !updateMutation.isPending && setEditingTeacher(null)} title="Chỉnh sửa giáo viên" description={editingTeacher?.name} className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editingTeacher && <form onSubmit={handleEdit} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên"><input name="name" required defaultValue={editingTeacher.name} className={inputClass} /></Field>
            <Field label="Thứ tự"><input name="order" type="number" min="0" step="1" defaultValue={editingTeacher.order} className={inputClass} /></Field>
            <TeacherTypeCheckboxes initial={editingTeacher.type} />
            <Field label="Lương cơ bản"><input name="baseSalary" type="number" min="0" step="1000" defaultValue={editingTeacher.baseSalary} className={inputClass} /></Field>
            <Field label="Hỗ trợ bảo hiểm"><input name="insuranceSupport" type="number" min="0" step="1000" defaultValue={editingTeacher.insuranceSupport} className={inputClass} /></Field>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isPayInsurance" type="checkbox" defaultChecked={editingTeacher.isPayInsurance} className="h-4 w-4 accent-primary" />Có đóng bảo hiểm</label>
            <Field label="Chuyên cần"><input name="attendanceBonus" type="number" min="0" step="1000" defaultValue={editingTeacher.attendanceBonus} className={inputClass} /></Field>
            <Field label="Số buổi/ngày"><input name="sessionsPerDay" type="number" min="0" step="1" defaultValue={editingTeacher.sessionsPerDay} className={inputClass} /></Field>
            <Field label="Lương khác"><input name="otherSalary" type="number" min="0" step="1000" defaultValue={editingTeacher.otherSalary} className={inputClass} /></Field>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isSalaryByMonth" type="checkbox" defaultChecked={editingTeacher.isSalaryByMonth} className="h-4 w-4 accent-primary" />Trả lương cố định theo tháng</label>
            <Field label="Tài khoản"><input name="account" required defaultValue={editingTeacher.account} className={inputClass} /></Field>
            <Field label="Email"><input name="email" type="email" required defaultValue={editingTeacher.email} className={inputClass} /></Field>
            <Field label="Số điện thoại"><input name="phone" required defaultValue={editingTeacher.phone} className={inputClass} /></Field>
            <Field label="Ngân hàng"><select name="bankCode" defaultValue={VIETNAM_BANKS.find((bank) => bank.shortName.toLocaleLowerCase() === editingTeacher.nameBank?.toLocaleLowerCase() || bank.code.toLocaleLowerCase() === editingTeacher.nameBank?.toLocaleLowerCase())?.code || ''} className={`${inputClass} w-full min-w-0 max-w-full text-ellipsis`}><option value="">Chọn ngân hàng</option>{VIETNAM_BANKS.map((bank) => <option key={bank.code} value={bank.code}>{bank.shortName} · {bank.code} · {bank.name}</option>)}</select></Field>
            <Field label="Số tài khoản"><input name="accountBank" defaultValue={editingTeacher.accountBank} className={inputClass} /></Field>
            <Field label="Địa chỉ" wide><input name="address" required defaultValue={editingTeacher.address} className={inputClass} /></Field>
            <Field label="Mô tả" wide><input name="description" defaultValue={editingTeacher.description} className={inputClass} /></Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setEditingTeacher(null)} disabled={updateMutation.isPending}>Hủy</Button><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div>
        </form>}
      </Modal>
    </div>
  )
}
