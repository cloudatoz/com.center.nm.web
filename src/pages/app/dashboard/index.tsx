import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Loader2, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { getDashboardOverview } from '@/services/apis/dashboard-api'

const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const formatMoney = (value: number) => `${Math.round(value || 0).toLocaleString('vi-VN')} đ`
const formatCompactMoney = (value: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const overviewQuery = useQuery({ queryKey: ['dashboard-overview', year], queryFn: () => getDashboardOverview(year) })
  const selected = overviewQuery.data?.months[month - 1]
  const chartMax = useMemo(() => Math.max(1, ...(overviewQuery.data?.months.flatMap((item) => [item.revenue, item.expense]) || [1])), [overviewQuery.data])

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="flex items-center gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><TrendingUp size={23} /></span><div><span className="text-xs font-semibold text-muted">Tổng thu Tháng {month}</span><strong className="mt-1 block text-xl text-emerald-600">{formatMoney(selected.revenue)}</strong></div></Card>
          <Card className="flex items-center gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-600"><TrendingDown size={23} /></span><div><span className="text-xs font-semibold text-muted">Tổng chi Tháng {month}</span><strong className="mt-1 block text-xl text-red-600">{formatMoney(selected.expense)}</strong></div></Card>
          <Card className="flex items-center gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><GraduationCap size={23} /></span><div><span className="text-xs font-semibold text-muted">Tổng số học sinh</span><strong className="mt-1 block text-xl text-text-main">{overviewQuery.data.childrenCount}</strong></div></Card>
          <Card className="flex items-center gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-purple-600"><Users size={23} /></span><div><span className="text-xs font-semibold text-muted">Tổng số giáo viên</span><strong className="mt-1 block text-xl text-text-main">{overviewQuery.data.teachersCount}</strong></div></Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader title={`Biểu đồ Thu - Chi năm ${year}`} description="So sánh tổng thu và tổng chi theo từng tháng." />
            <div className="overflow-x-auto p-5 pt-2 sm:p-6 sm:pt-2">
              <div className="flex min-h-72 min-w-[720px] items-end gap-3 border-b border-border pt-8">
                {overviewQuery.data.months.map((item, index) => <div key={item.month} className="flex h-64 flex-1 flex-col justify-end gap-2 text-center"><div className="flex flex-1 items-end justify-center gap-1.5"><div title={`Thu: ${formatMoney(item.revenue)}`} className="w-4 rounded-t-md bg-emerald-500 transition-all" style={{ height: `${Math.max(item.revenue ? 4 : 0, item.revenue / chartMax * 100)}%` }} /><div title={`Chi: ${formatMoney(item.expense)}`} className="w-4 rounded-t-md bg-red-500 transition-all" style={{ height: `${Math.max(item.expense ? 4 : 0, item.expense / chartMax * 100)}%` }} /></div><span className={`pb-2 text-xs font-semibold ${month === index + 1 ? 'text-primary' : 'text-muted'}`}>T{index + 1}</span></div>)}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><div className="flex gap-4"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Tổng thu</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-red-500" />Tổng chi</span></div><span>Mức cao nhất: {formatCompactMoney(chartMax)} đ</span></div>
            </div>
          </Card>
          <Card>
            <CardHeader title={`Chi tiết chi Tháng ${month}`} description="Các nhóm chi phí đã tổng hợp." />
            <dl className="m-0 grid gap-3 p-5 pt-0 sm:p-6 sm:pt-0">
              <div className="rounded-xl bg-surface-muted/60 p-4"><dt className="text-xs font-semibold text-muted">Chi phí vận hành</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selected.operatingCost)}</dd></div>
              <div className="rounded-xl bg-surface-muted/60 p-4"><dt className="text-xs font-semibold text-muted">Lương giáo viên theo buổi</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selected.sessionSalary)}</dd></div>
              <div className="rounded-xl bg-surface-muted/60 p-4"><dt className="text-xs font-semibold text-muted">Lương giáo viên cố định</dt><dd className="m-0 mt-1 font-bold">{formatMoney(selected.monthlySalary)}</dd></div>
              <div className={`rounded-xl p-4 ${selected.profit >= 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}><dt className="text-xs font-semibold">Chênh lệch Thu - Chi</dt><dd className="m-0 mt-1 text-lg font-bold">{formatMoney(selected.profit)}</dd></div>
            </dl>
          </Card>
        </div>
      </>}
    </div>
  )
}
