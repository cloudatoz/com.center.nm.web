import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Eye, Loader2, Pencil, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getMonthlyAttendances } from '@/services/apis/attendance-api'
import { deleteTeacher, getSalaryMonth, getTeachers, type Teacher, updateTeacher } from '@/services/apis/teachers-api'

const inputClass = 'h-10 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary'
const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const currentMonth = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`grid gap-1.5 text-sm font-semibold ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label>
}

function InfoItem({ label, value, wide }: { label: string; value?: React.ReactNode; wide?: boolean }) {
  return <div className={`rounded-xl bg-surface-muted/60 p-3 ${wide ? 'sm:col-span-2' : ''}`}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="m-0 mt-1 text-sm font-medium text-text-main">{value || '—'}</dd></div>
}

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [detailTeacher, setDetailTeacher] = useState<Teacher | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [salaryMonth, setSalaryMonth] = useState(currentMonth)
  const [salaryYear, salaryMonthNumber] = salaryMonth.split('-').map(Number)
  const teachersQuery = useQuery({ queryKey: ['teachers'], queryFn: getTeachers })
  const salaryMonthQuery = useQuery({ queryKey: ['salary-month', salaryMonth], queryFn: () => getSalaryMonth(salaryMonth) })
  const monthlyAttendanceQuery = useQuery({ queryKey: ['teacher-monthly-history', salaryMonth], queryFn: () => getMonthlyAttendances(salaryMonth, 'ALL') })
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

  const filteredTeachers = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return teachersQuery.data || []
    return (teachersQuery.data || []).filter((teacher) =>
      [teacher.name, teacher.account, teacher.email, teacher.phone]
        .join(' ').toLocaleLowerCase('vi').includes(keyword),
    )
  }, [search, teachersQuery.data])

  const monthlyTeachingByTeacher = useMemo(() => {
    const result = new Map<string, { children: Map<string, { name: string; dates: number[] }>; totalHours: number }>()
    for (const attendance of monthlyAttendanceQuery.data || []) {
      if (typeof attendance.children === 'string') continue
      for (const day of attendance.days) {
        if (day.absent || !day.teacherId) continue
        const teacher = result.get(day.teacherId) || { children: new Map<string, { name: string; dates: number[] }>(), totalHours: 0 }
        const child = teacher.children.get(attendance.children._id) || { name: attendance.children.name, dates: [] }
        const date = Number(day.date.slice(8, 10))
        if (!child.dates.includes(date)) child.dates.push(date)
        child.dates.sort((left, right) => left - right)
        teacher.children.set(attendance.children._id, child)
        teacher.totalHours += day.spendTime
        result.set(day.teacherId, teacher)
      }
    }
    return result
  }, [monthlyAttendanceQuery.data])

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTeacher) return
    const form = new FormData(event.currentTarget)
    updateMutation.mutate({
      id: editingTeacher._id,
      data: {
        name: String(form.get('name') || '').trim(),
        account: String(form.get('account') || '').trim(),
        email: String(form.get('email') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        address: String(form.get('address') || '').trim(),
        description: String(form.get('description') || '').trim(),
        otherSalary: Number(form.get('otherSalary')) || 0,
        type: String(form.get('type')) as Teacher['type'],
        baseSalary: Number(form.get('baseSalary')) || 0,
        insuranceSupport: Number(form.get('insuranceSupport')) || 0,
        attendanceBonus: Number(form.get('attendanceBonus')) || 0,
        sessionsPerDay: Number(form.get('sessionsPerDay')) || 0,
        isSalaryByMonth: form.get('isSalaryByMonth') === 'on',
        accountBank: String(form.get('accountBank') || '').trim(),
        nameBank: String(form.get('nameBank') || '').trim(),
      },
    })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Giáo Viên" title="Danh sách Giáo Viên" description="Theo dõi và quản lý hồ sơ, thông tin lương của giáo viên." />
      <Card>
        <CardHeader title={`Lương cố định Tháng ${salaryMonthNumber}/${salaryYear}`} description={`${salaryMonthQuery.data?.salaries.length || 0} giáo viên hưởng lương theo tháng`} />
        <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={salaryMonthNumber} onChange={(event) => setSalaryMonth(`${salaryYear}-${String(event.target.value).padStart(2, '0')}`)} className={inputClass}>{MONTHS.map((month) => <option key={month} value={month}>Tháng {month}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={salaryYear} onChange={(event) => setSalaryMonth(`${event.target.value}-${String(salaryMonthNumber).padStart(2, '0')}`)} className={inputClass}>{YEARS.map((year) => <option key={year} value={year}>Năm {year}</option>)}</select></label>
          {salaryMonthQuery.data && <div className="ml-auto self-end rounded-xl bg-primary/10 px-4 py-2"><span className="block text-[11px] font-semibold uppercase text-muted">Tổng lương tháng</span><strong className="text-lg text-primary">{formatMoney(salaryMonthQuery.data.totalSalary)}</strong></div>}
        </div>
        {salaryMonthQuery.isLoading && <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tải lương tháng...</div>}
        {salaryMonthQuery.isError && <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải danh sách lương tháng.</div>}
        {salaryMonthQuery.data && salaryMonthQuery.data.salaries.length === 0 && <div className="grid min-h-32 place-items-center text-sm text-muted">Chưa có giáo viên hưởng lương theo tháng.</div>}
        {salaryMonthQuery.data && salaryMonthQuery.data.salaries.length > 0 && <Table><TableHeader><TableRow><TableHead>Giáo viên</TableHead><TableHead>Trẻ và ngày dạy</TableHead><TableHead>Số giờ</TableHead><TableHead>Lương cơ bản</TableHead><TableHead>Hỗ trợ bảo hiểm</TableHead><TableHead>Chuyên cần</TableHead><TableHead>Lương khác</TableHead><TableHead>Tổng lương</TableHead></TableRow></TableHeader><TableBody>{salaryMonthQuery.data.salaries.map((salary) => {
          const teaching = monthlyTeachingByTeacher.get(salary.teacherId)
          return <TableRow key={salary.teacherId}><TableCell className="font-semibold">{salary.teacherName}</TableCell><TableCell>{teaching?.children.size ? <div className="grid min-w-52 gap-1">{[...teaching.children.values()].map((child) => <span key={child.name}><strong>{child.name}:</strong> {child.dates.join(', ')}/{salaryMonthNumber}</span>)}</div> : '—'}</TableCell><TableCell className="whitespace-nowrap">{teaching?.totalHours ? `${teaching.totalHours} giờ` : '—'}</TableCell><TableCell>{formatMoney(salary.baseSalary)}</TableCell><TableCell>{formatMoney(salary.insuranceSupport)}</TableCell><TableCell>{formatMoney(salary.attendanceBonus)}</TableCell><TableCell>{formatMoney(salary.otherSalary)}</TableCell><TableCell className="font-bold text-primary">{formatMoney(salary.totalSalary)}</TableCell></TableRow>
        })}</TableBody></Table>}
      </Card>
      <Card>
        <CardHeader title={`Danh sách Giáo Viên (${filteredTeachers.length})`} description="Tìm kiếm theo tên, tài khoản, email hoặc số điện thoại." action={<Button type="button" variant="secondary" size="compact" onClick={() => teachersQuery.refetch()} disabled={teachersQuery.isFetching}><RefreshCw size={15} className={teachersQuery.isFetching ? 'spin' : ''} />Làm mới</Button>} />
        <div className="border-b border-border p-4 sm:px-6"><label className="relative block max-w-md"><span className="sr-only">Tìm kiếm giáo viên</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm giáo viên..." className="h-10 w-full rounded-xl border border-border bg-app-background pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label></div>

        {teachersQuery.isLoading && <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tải danh sách giáo viên...</div>}
        {teachersQuery.isError && <div className="m-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={19} /><div><strong>Không thể tải danh sách giáo viên</strong><span className="mt-1 block">{teachersQuery.error instanceof Error ? teachersQuery.error.message : 'Vui lòng thử lại sau.'}</span></div></div>}
        {teachersQuery.isSuccess && filteredTeachers.length === 0 && <div className="grid min-h-64 place-items-center text-center"><div><Users size={34} className="mx-auto text-muted" /><p className="mb-0 mt-3 font-semibold">Không tìm thấy giáo viên</p></div></div>}

        {teachersQuery.isSuccess && filteredTeachers.length > 0 && <Table>
          <TableHeader><TableRow><TableHead>Giáo viên</TableHead><TableHead>Loại</TableHead><TableHead>Lương cơ bản</TableHead><TableHead>Hỗ trợ bảo hiểm</TableHead><TableHead>Chuyên cần</TableHead><TableHead>Tổng lương</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
          <TableBody>{filteredTeachers.map((teacher) => <TableRow key={teacher._id}>
            <TableCell><div className="flex min-w-44 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary">{teacher.name.charAt(0).toUpperCase()}</span><div><strong className="block">{teacher.name}</strong><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${teacher.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'}`}>{teacher.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></div></div></TableCell>
            <TableCell><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${teacher.type === 'BAN_TRU' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'}`}>{teacher.type === 'BAN_TRU' ? `Bán trú${teacher.sessionsPerDay ? ` · ${teacher.sessionsPerDay} buổi` : ''}` : 'Theo buổi'}</span></TableCell>
            <TableCell className="whitespace-nowrap font-medium">{formatMoney(teacher.baseSalary)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatMoney(teacher.insuranceSupport)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatMoney(teacher.attendanceBonus)}</TableCell>
            <TableCell className="whitespace-nowrap font-bold text-primary">{formatMoney(teacher.baseSalary + teacher.insuranceSupport + teacher.attendanceBonus + teacher.otherSalary)}</TableCell>
            <TableCell><div className="flex min-w-64 justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setDetailTeacher(teacher)}><Eye size={14} />Thông tin</Button><Button type="button" size="sm" onClick={() => setEditingTeacher(teacher)}><Pencil size={14} />Chỉnh sửa</Button>{teacher.active && <Button type="button" variant="danger" size="sm" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Xóa giáo viên “${teacher.name}”? Giáo viên sẽ chuyển sang trạng thái ngừng hoạt động.`)) deleteMutation.mutate(teacher._id) }}><Trash2 size={14} />Xóa</Button>}</div></TableCell>
          </TableRow>)}</TableBody>
        </Table>}
      </Card>

      <Modal open={Boolean(detailTeacher)} onClose={() => setDetailTeacher(null)} title={detailTeacher?.name || 'Thông tin giáo viên'} description="Hồ sơ và thông tin lương" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {detailTeacher && <dl className="m-0 grid gap-3 sm:grid-cols-2"><InfoItem label="Loại giáo viên" value={detailTeacher.type === 'BAN_TRU' ? 'Bán trú' : 'Theo buổi'} /><InfoItem label="Số buổi/ngày" value={detailTeacher.sessionsPerDay || '—'} /><InfoItem label="Lương cơ bản" value={formatMoney(detailTeacher.baseSalary)} /><InfoItem label="Hỗ trợ bảo hiểm" value={formatMoney(detailTeacher.insuranceSupport)} /><InfoItem label="Chuyên cần" value={formatMoney(detailTeacher.attendanceBonus)} /><InfoItem label="Lương khác" value={formatMoney(detailTeacher.otherSalary)} /><InfoItem label="Tài khoản" value={detailTeacher.account} /><InfoItem label="Email" value={detailTeacher.email} /><InfoItem label="Số điện thoại" value={detailTeacher.phone} /><InfoItem label="Tổng lương" value={formatMoney(detailTeacher.baseSalary + detailTeacher.insuranceSupport + detailTeacher.attendanceBonus + detailTeacher.otherSalary)} /><InfoItem label="Ngân hàng" value={detailTeacher.nameBank} /><InfoItem label="Số tài khoản" value={detailTeacher.accountBank} /><InfoItem label="Địa chỉ" value={detailTeacher.address} wide /><InfoItem label="Mô tả" value={detailTeacher.description} wide /></dl>}
      </Modal>

      <Modal open={Boolean(editingTeacher)} onClose={() => !updateMutation.isPending && setEditingTeacher(null)} title="Chỉnh sửa giáo viên" description={editingTeacher?.name} className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editingTeacher && <form onSubmit={handleEdit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Họ và tên"><input name="name" required defaultValue={editingTeacher.name} className={inputClass} /></Field><Field label="Loại giáo viên"><select name="type" defaultValue={editingTeacher.type} className={inputClass}><option value="BAN_TRU">Bán trú</option><option value="THEO_BUOI">Theo buổi</option><option value="CA_NHAN">Cá nhân</option></select></Field><Field label="Lương cơ bản"><input name="baseSalary" type="number" min="0" step="1000" defaultValue={editingTeacher.baseSalary} className={inputClass} /></Field><Field label="Hỗ trợ bảo hiểm"><input name="insuranceSupport" type="number" min="0" step="1000" defaultValue={editingTeacher.insuranceSupport} className={inputClass} /></Field><Field label="Chuyên cần"><input name="attendanceBonus" type="number" min="0" step="1000" defaultValue={editingTeacher.attendanceBonus} className={inputClass} /></Field><Field label="Số buổi/ngày"><input name="sessionsPerDay" type="number" min="0" step="1" defaultValue={editingTeacher.sessionsPerDay} className={inputClass} /></Field><Field label="Lương khác"><input name="otherSalary" type="number" min="0" step="1000" defaultValue={editingTeacher.otherSalary} className={inputClass} /></Field><label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input name="isSalaryByMonth" type="checkbox" defaultChecked={editingTeacher.isSalaryByMonth} className="h-4 w-4 accent-primary" />Trả lương cố định theo tháng</label><Field label="Tài khoản"><input name="account" required defaultValue={editingTeacher.account} className={inputClass} /></Field><Field label="Email"><input name="email" type="email" required defaultValue={editingTeacher.email} className={inputClass} /></Field><Field label="Số điện thoại"><input name="phone" required defaultValue={editingTeacher.phone} className={inputClass} /></Field><Field label="Tên ngân hàng"><input name="nameBank" defaultValue={editingTeacher.nameBank} className={inputClass} /></Field><Field label="Số tài khoản"><input name="accountBank" defaultValue={editingTeacher.accountBank} className={inputClass} /></Field><Field label="Địa chỉ" wide><input name="address" required defaultValue={editingTeacher.address} className={inputClass} /></Field><Field label="Mô tả" wide><textarea name="description" rows={3} defaultValue={editingTeacher.description} className="rounded-xl border border-border bg-app-background p-3 font-normal outline-none focus:border-primary" /></Field></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="secondary" onClick={() => setEditingTeacher(null)} disabled={updateMutation.isPending}>Hủy</Button><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending && <Loader2 size={16} className="spin" />}Lưu thay đổi</Button></div></form>}
      </Modal>
    </div>
  )
}
