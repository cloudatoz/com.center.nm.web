import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, GraduationCap, Loader2, Send, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAccountBanks } from '@/services/apis/account-bank-api'
import { getDashboardOverview, updateDashboardDetail } from '@/services/apis/dashboard-api'

const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const CHILD_TYPES = [
  ['CA_NGAY', 'Cả ngày', 'bg-blue-500/10 text-blue-700 dark:text-blue-300'],
  ['CA_NHAN', 'Cá nhân', 'bg-purple-500/10 text-purple-700 dark:text-purple-300'],
  ['TAI_NHA', 'Tại nhà', 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['SHADOW', 'Shadow', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
] as const
const REVENUE_TYPES = [
  ['CA_NGAY', 'Cả ngày', 'bg-blue-500/10 text-blue-700 dark:text-blue-300'],
  ['THEO_BUOI', 'Cá nhân', 'bg-purple-500/10 text-purple-700 dark:text-purple-300'],
  ['TAI_NHA', 'Tại nhà', 'bg-amber-500/10 text-amber-700 dark:text-amber-300'],
  ['SHADOW', 'Shadow', 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
] as const
const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} đ`
const formatCompactMoney = (value: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)
const attendanceTypeLabel: Record<string, string> = {
  CA_NGAY: 'Cả ngày', THEO_BUOI: 'Cá nhân', TAI_NHA: 'Tại nhà', SHADOW: 'Shadow',
}
const attendanceTypeColor: Record<string, string> = {
  CA_NGAY: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  THEO_BUOI: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  TAI_NHA: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  SHADOW: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
}
const teacherLineClass = 'flex min-h-9 items-center border-b border-border/70 py-1.5 last:border-b-0'
const paymentStatusMeta = {
  NOT_COLLECTED: { label: 'C', title: 'Chưa thu', icon: Clock, className: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' },
  RECEIPT_SENT: { label: 'G', title: 'Đã gửi phiếu PH', icon: Send, className: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300' },
  COLLECTED: { label: 'GR', title: 'Đã thu', icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
} as const
const paymentStatusOrder = ['NOT_COLLECTED', 'RECEIPT_SENT', 'COLLECTED'] as const
const abbreviateName = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return name
  return `${words.slice(0, -1).map((word) => `${word[0].toLocaleUpperCase('vi')}.`).join(' ')} ${words.at(-1)}`
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [typeFilter, setTypeFilter] = useState('ALL')
  const overviewQuery = useQuery({ queryKey: ['dashboard-overview', year], queryFn: () => getDashboardOverview(year) })
  const accountBanksQuery = useQuery({ queryKey: ['account-banks'], queryFn: getAccountBanks })
  const selected = overviewQuery.data?.months[month - 1]
  const filteredDetails = selected?.details.filter((row) => typeFilter === 'ALL' || row.types.includes(typeFilter)) || []
  const updateDetailMutation = useMutation({
    mutationFn: ({ childrenId, body }: { childrenId: string; body: Parameters<typeof updateDashboardDetail>[2] }) => updateDashboardDetail(`${year}-${String(month).padStart(2, '0')}`, childrenId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-overview', year] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu'),
  })

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Tổng quan" title="Bảng Số Liệu" description="Theo dõi thu, chi, nhân sự và kết quả hoạt động theo từng tháng." />
      <Card className="flex flex-wrap items-end gap-3 p-4 sm:px-6">
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
      </Card>
      {overviewQuery.isLoading && <Card className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={20} className="spin text-primary" />Đang tổng hợp số liệu...</Card>}
      {overviewQuery.isError && <Card className="p-5 text-sm text-red-700">{overviewQuery.error instanceof Error ? overviewQuery.error.message : 'Không thể tải bảng số liệu'}</Card>}
      {overviewQuery.data && selected && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600"><TrendingUp size={16} /></span><span className="text-xs font-semibold text-muted">Tổng thu Tháng {month}</span></div><strong className="mt-3 block text-lg text-emerald-600">{formatMoney(selected.revenue)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600"><TrendingDown size={16} /></span><span className="text-xs font-semibold text-muted">Tổng chi Tháng {month}</span></div><strong className="mt-3 block text-lg text-red-600">{formatMoney(selected.expense)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${selected.profit >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>{selected.profit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</span><span className="text-xs font-semibold text-muted">Chênh lệch Thu - Chi</span></div><strong className={`mt-3 block text-lg ${selected.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(selected.profit)}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600"><GraduationCap size={16} /></span><span className="text-xs font-semibold text-muted">Tổng số học sinh</span></div><strong className="mt-3 block text-lg text-text-main">{overviewQuery.data.childrenCount}</strong></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-600"><Users size={16} /></span><span className="text-xs font-semibold text-muted">Tổng số giáo viên</span></div><strong className="mt-3 block text-lg text-text-main">{overviewQuery.data.teachersCount}</strong></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="overflow-hidden">
            <CardHeader title={`Chi tiết tổng thu Tháng ${month}`} description="Doanh thu được phân theo từng loại học." />
            <Table>
              <TableHeader><TableRow><TableHead>Loại học</TableHead><TableHead className="text-right">Doanh thu</TableHead><TableHead className="text-right">Tỷ trọng</TableHead></TableRow></TableHeader>
              <TableBody>
                {REVENUE_TYPES.map(([type, label, color]) => {
                  const revenue = selected.revenueByType[type]
                  const percentage = selected.revenue > 0 ? revenue / selected.revenue * 100 : 0
                  return <TableRow key={type}><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span></TableCell><TableCell className="text-right font-bold">{formatMoney(revenue)}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title={`Chi tiết chi Tháng ${month}`} description="Các nhóm chi phí đã tổng hợp." />
            <Table>
              <TableHeader><TableRow><TableHead>Khoản chi</TableHead><TableHead className="text-right">Số tiền</TableHead><TableHead className="text-right">Tỷ trọng</TableHead></TableRow></TableHeader>
              <TableBody>
                {[
                  ['Chi phí vận hành', selected.operatingCost],
                  ['Lương GV theo buổi', selected.sessionSalary],
                  ['Lương GV cố định', selected.monthlySalary],
                ].map(([label, amount]) => {
                  const value = Number(amount)
                  const percentage = selected.expense > 0 ? value / selected.expense * 100 : 0
                  return <TableRow key={String(label)}><TableCell className="font-medium">{label}</TableCell><TableCell className="text-right font-bold text-red-600 dark:text-red-400">{formatMoney(value)}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Chi tiết học sinh" description="Một học sinh có thể thuộc nhiều loại học." />
            <Table>
              <TableHeader><TableRow><TableHead>Loại học</TableHead><TableHead className="text-right">Số học sinh</TableHead><TableHead className="text-right">Tỷ lệ</TableHead></TableRow></TableHeader>
              <TableBody>
                {CHILD_TYPES.map(([type, label, color]) => {
                  const count = overviewQuery.data.childrenByType[type]
                  const percentage = overviewQuery.data.childrenCount > 0 ? count / overviewQuery.data.childrenCount * 100 : 0
                  return <TableRow key={type}><TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>{label}</span></TableCell><TableCell className="text-right font-bold">{count}</TableCell><TableCell className="text-right text-muted">{percentage.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</TableCell></TableRow>
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <CardHeader title={`Bảng tổng hợp Tháng ${month}/${year}`} description="Tổng hợp khoản thu, tài khoản nhận tiền và lương giáo viên theo từng trẻ." action={<label className="grid gap-1 text-xs font-semibold text-muted">Loại học<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary"><option value="ALL">Tất cả loại</option><option value="CA_NGAY">Cả ngày</option><option value="THEO_BUOI">Cá nhân</option><option value="TAI_NHA">Tại nhà</option><option value="SHADOW">Shadow</option></select></label>} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-orange-200 bg-orange-50 px-5 py-2 text-xs text-text-main dark:border-orange-500/20 dark:bg-orange-500/10"><div className="flex flex-wrap items-center gap-1.5"><strong>PH:</strong><span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-bold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">C</span><span>= Chưa thu</span><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">G</span><span>= Đã gửi phiếu PH</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">GR</span><span>= Đã thu</span></div><div className="flex flex-wrap items-center gap-1.5"><strong>GV:</strong><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">C</span><span>= Chưa gửi</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">G</span><span>= Đã chuyển lương</span></div></div>
          <Table containerClassName="max-h-[100vh] overflow-auto" className="min-w-[980px] [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-white/30 [&_th:last-child]:border-r-0">
            <TableHeader className="sticky top-0 z-30 border-orange-300 bg-orange-500 text-white shadow-md dark:bg-orange-600 dark:text-white">
              <TableRow className="hover:bg-orange-500 dark:hover:bg-orange-600">
                <TableHead className="w-14 text-center text-white">STT</TableHead>
                <TableHead className="w-32 max-w-32 text-white">Tên trẻ</TableHead>
                <TableHead className="w-24 max-w-24 text-right text-white">Phí thu</TableHead>
                <TableHead className="text-right text-white">Tổng thu</TableHead>
                <TableHead className="text-white">Tài khoản</TableHead>
                <TableHead className="text-center text-white">Xác nhận PH</TableHead>
                <TableHead className="min-w-[430px] text-white"><div className="grid grid-cols-[minmax(90px,1fr)_80px_72px_minmax(100px,1fr)_80px] items-stretch gap-3"><span>Giáo viên</span><span className="border-l border-white/30 pl-3 text-right">Số tiết</span><span className="border-l border-white/30 pl-3 text-right">Lương</span><span className="border-l border-white/30 pl-3 text-right">Thực lãnh</span><span className="border-l border-white/30 pl-3 text-center">Xác nhận</span></div></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDetails.map((row, index) => <TableRow key={row.childId}>
                <TableCell className="text-center text-muted">{index + 1}</TableCell>
                <TableCell className="w-32 max-w-32"><Link to={`/students/history?month=${year}-${String(month).padStart(2, '0')}&childId=${row.childId}`} className="block truncate whitespace-nowrap font-bold text-primary underline-offset-2 transition hover:underline" title={`Mở điểm danh của ${row.childName}`}>{abbreviateName(row.childName)}</Link><div className="mt-1 flex flex-wrap gap-1">{row.types.map((type) => <span key={type} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${attendanceTypeColor[type] || 'bg-surface-muted text-muted'}`}>{attendanceTypeLabel[type] || type}</span>)}</div></TableCell>
                <TableCell className="w-24 max-w-24 text-right text-xs font-medium"><div className="grid gap-0.5 whitespace-nowrap">{row.feeAmounts.length ? row.feeAmounts.map((amount) => <span key={amount}>{formatMoney(amount)}</span>) : '—'}</div></TableCell>
                <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(row.totalRevenue)}</TableCell>
                <TableCell><select value={row.accountBankId || ''} disabled={updateDetailMutation.isPending || accountBanksQuery.isLoading} onChange={(event) => updateDetailMutation.mutate({ childrenId: row.childId, body: { accountBankId: event.target.value || null } })} aria-label={`Tài khoản nhận tiền của ${row.childName}`} className="h-9 max-w-28 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-text-main outline-none focus:border-primary"><option value="">Tiền mặt</option>{accountBanksQuery.data?.map((account) => <option key={account._id} value={account._id}>{account.description || account.bankName}</option>)}</select></TableCell>
                <TableCell className="text-center">{(() => { const meta = paymentStatusMeta[row.paymentStatus]; const Icon = meta.icon; const currentIndex = paymentStatusOrder.indexOf(row.paymentStatus); const nextStatus = paymentStatusOrder[(currentIndex + 1) % paymentStatusOrder.length]; return <button type="button" title={`${meta.title} · Bấm để chuyển trạng thái`} aria-label={`${meta.title} của ${row.childName}`} disabled={updateDetailMutation.isPending} onClick={() => updateDetailMutation.mutate({ childrenId: row.childId, body: { status: nextStatus } })} className={`inline-flex h-9 min-w-16 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-extrabold shadow-xs transition disabled:cursor-wait disabled:opacity-60 ${meta.className}`}><Icon size={14} />{meta.label}</button> })()}</TableCell>
                <TableCell className="py-1"><div>{row.teachers.length ? row.teachers.map((teacher) => <div key={`${teacher.teacherId}-${teacher.name}`} className="grid min-h-10 grid-cols-[minmax(90px,1fr)_80px_72px_minmax(100px,1fr)_80px] items-stretch gap-3 border-b border-border/70 py-1.5 last:border-b-0"><strong className="flex min-w-0 items-center truncate whitespace-nowrap" title={teacher.name}>{abbreviateName(teacher.name)}</strong><span className="flex items-center justify-end whitespace-nowrap border-l border-border/70 pl-3 text-muted">{teacher.lessons.toLocaleString('vi-VN')} tiết</span><span className="grid content-center gap-0.5 whitespace-nowrap border-l border-border/70 pl-3 text-right text-xs">{teacher.rates.length ? teacher.rates.map((rate) => <span key={rate}>{formatMoney(rate)}</span>) : '—'}</span><strong className="flex items-center justify-end whitespace-nowrap border-l border-border/70 pl-3 text-blue-600 dark:text-blue-400">{formatMoney(teacher.actualSalary)}</strong><div className="flex items-center justify-center border-l border-border/70 pl-3"><button type="button" title={`${teacher.isTransferred ? 'Đã chuyển lương' : 'Chưa gửi'} · Bấm để đổi trạng thái`} aria-label={`Xác nhận chuyển lương của ${teacher.name}`} disabled={updateDetailMutation.isPending} onClick={() => updateDetailMutation.mutate({ childrenId: row.childId, body: { salaryTransfer: { teacherKey: teacher.teacherKey, isTransferred: !teacher.isTransferred } } })} className={`inline-flex h-8 min-w-14 items-center justify-center gap-1.5 rounded-full border px-2.5 text-[11px] font-extrabold shadow-xs transition disabled:cursor-wait disabled:opacity-60 ${teacher.isTransferred ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}`}>{teacher.isTransferred ? <CheckCircle2 size={13} /> : <Clock size={13} />}{teacher.isTransferred ? 'G' : 'C'}</button></div></div>) : '—'}</div></TableCell>
              </TableRow>)}
              {!filteredDetails.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted">{typeFilter === 'ALL' ? 'Chưa có dữ liệu trong tháng này.' : 'Không có trẻ thuộc loại học đã chọn.'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
        <Card className="min-w-0 overflow-hidden">
            <CardHeader title={`Biểu đồ Thu - Chi năm ${year}`} description="So sánh tổng thu, tổng chi và chênh lệch theo từng tháng." />
            <div className="h-80 min-w-0 p-4 pt-1 sm:p-6 sm:pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={overviewQuery.data.months.map((item, index) => ({ ...item, label: `T${index + 1}` }))} margin={{ top: 12, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} opacity={0.35} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(value) => formatCompactMoney(Number(value))} tickLine={false} axisLine={false} width={58} fontSize={11} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(label) => `${label}/${year}`} contentStyle={{ borderRadius: 12, borderColor: 'var(--color-border)', background: 'var(--color-surface)' }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Tổng thu" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="expense" name="Tổng chi" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="profit" name="Chênh lệch" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
        </Card>
      </>}
    </div>
  )
}
