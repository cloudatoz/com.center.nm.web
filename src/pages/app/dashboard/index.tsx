import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Loader2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getDashboardOverview } from '@/services/apis/dashboard-api'

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

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const overviewQuery = useQuery({ queryKey: ['dashboard-overview', year], queryFn: () => getDashboardOverview(year) })
  const selected = overviewQuery.data?.months[month - 1]

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
