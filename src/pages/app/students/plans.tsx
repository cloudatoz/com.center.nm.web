import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Loader2, Pencil, Save, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import age3Csv from '@/data/plan-templates/plan-age-3.csv?raw'
import age4Csv from '@/data/plan-templates/plan-age-4.csv?raw'
import age5Csv from '@/data/plan-templates/plan-age-5.csv?raw'
import age6Csv from '@/data/plan-templates/plan-age-6.csv?raw'
import { childTypeLabel } from '@/lib/child-pricing'
import { getChildren } from '@/services/apis/children-api'
import { createPlan, getPlans, PLAN_CATEGORIES, type PlanDay, updatePlan } from '@/services/apis/plan-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const currentMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
const dateKey = (value: string) => value.slice(0, 10)
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const formatPlanDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`)
  const weekday = WEEKDAY_SHORT[date.getDay()]
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return { weekday, label: `${weekday} ${day}/${month}`, isWeekend: date.getDay() === 0 || date.getDay() === 6 }
}
const emptyItems = () => PLAN_CATEGORIES.map((item) => ({ ...item, content: '' }))
const CATEGORY_COLORS: Record<string, string> = {
  NHAN_THUC_NGON_NGU: 'bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200',
  NHAN_THUC_TU_DUY_MAU_SAC: 'bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200',
  TUONG_TAC: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  BAT_CHUOC: 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200',
  VAN_DONG_TINH: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  VAN_DONG_THO: 'bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
}

const parseCsvLine = (line: string) => {
  const values: string[] = []
  let value = ''
  let isQuoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (isQuoted && line[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        isQuoted = !isQuoted
      }
    } else if (character === ',' && !isQuoted) {
      values.push(value)
      value = ''
    } else {
      value += character
    }
  }
  values.push(value)
  return values
}

const parseTemplateCsv = (csv: string) => csv
  .replace(/^\uFEFF/, '')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map(parseCsvLine)
  .map((columns) => ({ categoryKey: columns[2], content: columns[4] }))
  .filter((item) => item.categoryKey && item.content)

const TEMPLATE_CONTENTS = new Map([
  [3, parseTemplateCsv(age3Csv)],
  [4, parseTemplateCsv(age4Csv)],
  [5, parseTemplateCsv(age5Csv)],
  [6, parseTemplateCsv(age6Csv)],
])

export default function StudentPlansPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [selectedChildId, setSelectedChildId] = useState('')
  const [search, setSearch] = useState('')
  const [days, setDays] = useState<PlanDay[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isViewMode, setIsViewMode] = useState(false)
  const [year, monthNumber] = month.split('-').map(Number)
  const totalDays = new Date(year, monthNumber, 0).getDate()

  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getChildren })
  const plansQuery = useQuery({
    queryKey: ['plans', month, selectedChildId],
    queryFn: () => getPlans(month, selectedChildId),
    enabled: Boolean(selectedChildId),
    refetchOnWindowFocus: false,
  })
  const plan = plansQuery.data?.[0]

  useEffect(() => {
    if (!selectedChildId || !plansQuery.isSuccess) return
    const loadedDays = (plansQuery.data?.[0]?.days || []).map((day) => ({
      date: dateKey(day.date),
      items: PLAN_CATEGORIES.map((category) => {
        const item = day.items.find((current) => current.key === category.key)
        return { ...category, content: item?.content || '' }
      }),
    }))
    setDays(loadedDays)
    setIsDirty(false)
  }, [plansQuery.data, plansQuery.isSuccess, selectedChildId])

  const filteredChildren = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    return (childrenQuery.data || []).filter((child) => child.status === 'DANG_HOC' && (!keyword || child.name.toLocaleLowerCase('vi').includes(keyword)))
      .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'vi'))
  }, [childrenQuery.data, search])
  const selectedChild = childrenQuery.data?.find((child) => child._id === selectedChildId)
  const daysByDate = useMemo(() => new Map(days.map((day) => [dateKey(day.date), day])), [days])
  const monthlyDays = useMemo(() => Array.from({ length: totalDays }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`
    return daysByDate.get(date) || { date, items: emptyItems() }
  }), [daysByDate, month, totalDays])
  const populatedDayCount = useMemo(() => monthlyDays.filter((day) => day.items.some((item) => item.content.trim())).length, [monthlyDays])

  const saveMutation = useMutation({
    mutationFn: () => plan ? updatePlan(plan._id, days) : createPlan(month, selectedChildId, days),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans', month, selectedChildId] })
      setIsDirty(false)
      toast.success('Đã lưu kế hoạch tháng')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể lưu kế hoạch'),
  })

  const updateContent = (date: string, key: string, content: string) => {
    setDays((current) => {
      const existingDay = current.find((day) => dateKey(day.date) === date)
      const nextDay = {
        date,
        items: (existingDay?.items || emptyItems()).map((item) => item.key === key ? { ...item, content } : item),
      }
      return existingDay
        ? current.map((day) => dateKey(day.date) === date ? nextDay : day)
        : [...current, nextDay].sort((left, right) => dateKey(left.date).localeCompare(dateKey(right.date)))
    })
    setIsDirty(true)
  }
  const fillRandomExample = (date: string, categoryKey: string) => {
    if (!selectedChild) return
    const age = selectedChild.ages.find((item) => item.id === categoryKey)?.age ?? 3
    const currentContent = daysByDate.get(date)?.items.find((item) => item.key === categoryKey)?.content.trim()
    const matchingContents = (TEMPLATE_CONTENTS.get(age) || [])
      .filter((item) => item.categoryKey === categoryKey)
      .map((item) => item.content)
    if (!matchingContents.length) {
      toast.error('Hiện chỉ có nội dung mẫu dành cho trẻ từ 3 đến 6 tuổi')
      return
    }
    const differentContents = matchingContents.filter((content) => content !== currentContent)
    const choices = differentContents.length ? differentContents : matchingContents
    updateContent(date, categoryKey, choices[Math.floor(Math.random() * choices.length)])
  }
  const changeMonth = (nextMonth: string) => {
    if (isDirty && !window.confirm('Kế hoạch chưa lưu sẽ bị mất. Bạn vẫn muốn đổi tháng?')) return
    setMonth(nextMonth)
  }
  const selectChild = (childId: string) => {
    if (childId === selectedChildId) return
    if (isDirty && !window.confirm('Kế hoạch chưa lưu sẽ bị mất. Bạn vẫn muốn chọn trẻ khác?')) return
    setSelectedChildId(childId)
  }

  return <div className="grid min-w-0 gap-4">
    <PageHeader eyebrow="Học Sinh" title="Kế hoạch" description="Lập kế hoạch phát triển cho từng trẻ theo ngày và theo tháng." />
    <Card className="min-w-0 overflow-hidden">
      <CardHeader title={`Kế hoạch Tháng ${monthNumber}/${year}`} description={selectedChild ? `Trẻ: ${selectedChild.name} · ${days.length} ngày có kế hoạch` : 'Chọn trẻ để bắt đầu lập kế hoạch'} />
      <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
        <label className="grid gap-1 text-xs font-semibold text-muted">Tháng<select value={monthNumber} onChange={(event) => changeMonth(`${year}-${String(event.target.value).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold text-muted">Năm<select value={year} onChange={(event) => changeMonth(`${event.target.value}-${String(monthNumber).padStart(2, '0')}`)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text-main">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
      </div>
      <div className="grid min-w-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-surface-muted/50 p-3 lg:border-b-0 lg:border-r">
          <label className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên trẻ..." className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary" /></label>
          <div className="mt-3 grid max-h-56 gap-1.5 overflow-y-auto lg:max-h-[calc(100vh-20rem)]">{filteredChildren.map((child) => <button key={child._id} type="button" onClick={() => selectChild(child._id)} className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selectedChildId === child._id ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:border-primary/50'}`}><span className="block truncate">{child.name}</span><span className={`text-[10px] ${selectedChildId === child._id ? 'text-white/75' : 'text-muted'}`}>{child.type.map((item) => childTypeLabel(item.type)).join(' · ')}</span></button>)}</div>
        </aside>
        <main className="min-w-0 p-3 sm:p-5">
          {!selectedChildId && <div className="grid min-h-80 place-items-center text-center text-sm text-muted">Chọn một trẻ ở danh sách để tạo kế hoạch.</div>}
          {selectedChildId && plansQuery.isLoading && <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin" />Đang tải kế hoạch...</div>}
          {selectedChildId && plansQuery.isError && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Không thể tải kế hoạch của trẻ.</div>}
          {selectedChildId && plansQuery.isSuccess && <div className="grid gap-5">
            <section className="grid gap-3 rounded-xl border border-border bg-surface-muted/40 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2"><div className="mr-auto"><strong className="block">Toàn bộ kế hoạch Tháng {monthNumber}/{year}</strong><span className="text-xs text-muted">Đủ {totalDays} ngày · {populatedDayCount} ngày có nội dung · {selectedChild?.name}</span></div><Button type="button" size="sm" variant={isViewMode ? 'primary' : 'secondary'} onClick={() => setIsViewMode((current) => !current)}>{isViewMode ? <Pencil size={14} /> : <Eye size={14} />}{isViewMode ? 'Chỉnh sửa' : 'Xem'}</Button><Button type="button" size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}Lưu kế hoạch</Button></div>
              <Table className="min-w-[36rem]" containerClassName="max-h-[calc(100vh-16rem)] overflow-auto rounded-xl border border-border">
                <TableHeader className="sticky top-0 z-20 bg-surface-muted shadow-sm">
                  <TableRow>
                    <TableHead className="w-28 min-w-24 whitespace-nowrap bg-surface-muted">Ngày</TableHead>
                    <TableHead className="bg-surface-muted">Nội dung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y-0">
                  {monthlyDays.map((day) => {
                    const dayDate = dateKey(day.date)
                    const { label, isWeekend } = formatPlanDate(dayDate)
                    return <TableRow key={dayDate} className="align-top border-b-2 border-primary/35 last:border-b-0">
                      <TableCell className={`align-top ${isWeekend ? 'bg-amber-300/80 dark:bg-amber-500/40' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                        <div className="grid gap-2">
                          <strong className="whitespace-nowrap leading-snug">{label}</strong>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {isViewMode
                          ? <div className="grid gap-2">{day.items.map((item) => <div key={item.key} className="overflow-hidden rounded-lg border border-slate-200 bg-white"><strong className={`block px-2.5 py-1.5 text-sm ${CATEGORY_COLORS[item.key]}`}>{item.title}</strong><p className="m-0 whitespace-pre-wrap break-words bg-white px-2.5 py-2 text-sm font-normal leading-relaxed text-slate-800">{item.content || '—'}</p></div>)}</div>
                          : <div className="grid gap-3">{day.items.map((item) => {
                            const inputId = `plan-${dayDate}-${item.key}`
                            return <div key={item.key} className={`grid min-w-0 gap-1.5 rounded-lg p-2.5 text-sm font-semibold ${CATEGORY_COLORS[item.key]}`}>
                              <div className="flex min-w-0 items-center justify-between gap-2"><label htmlFor={inputId} className="min-w-0">{item.title}</label><Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => fillRandomExample(dayDate, item.key)}>Điền mẫu</Button></div>
                              <textarea id={inputId} value={item.content} onChange={(event) => updateContent(dayDate, item.key, event.target.value)} rows={2} placeholder="Nhập nội dung hoạt động..." className="min-h-16 w-full resize-y rounded-lg border border-border bg-white/80 p-2.5 text-sm font-normal leading-relaxed text-text-main outline-none focus:border-primary dark:bg-app-background" />
                            </div>
                          })}</div>}
                      </TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table>
            </section>
          </div>}
        </main>
      </div>
    </Card>
  </div>
}
