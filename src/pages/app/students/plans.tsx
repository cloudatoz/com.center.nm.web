import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Download, Loader2, Save, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { getMonthlyAttendances } from '@/services/apis/attendance-api'
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
  return { weekday, label: `${weekday} ${day}/${month}`, isSaturday: date.getDay() === 6, isSunday: date.getDay() === 0 }
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
  const [searchParams] = useSearchParams()
  const requestedChildId = searchParams.get('childId') || ''
  const requestedMonth = searchParams.get('month')
  const [month, setMonth] = useState(() => requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : currentMonth())
  const [selectedChildId, setSelectedChildId] = useState(requestedChildId)
  const [search, setSearch] = useState('')
  const [days, setDays] = useState<PlanDay[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null)
  const [year, monthNumber] = month.split('-').map(Number)
  const totalDays = new Date(year, monthNumber, 0).getDate()

  useEffect(() => {
    if (requestedChildId) setSelectedChildId(requestedChildId)
  }, [requestedChildId])
  useEffect(() => {
    if (requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) setMonth(requestedMonth)
  }, [requestedMonth])

  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: getChildren })
  const plansQuery = useQuery({
    queryKey: ['plans', month, selectedChildId],
    queryFn: () => getPlans(month, selectedChildId),
    enabled: Boolean(selectedChildId),
    refetchOnWindowFocus: false,
  })
  const attendancesQuery = useQuery({
    queryKey: ['plan-attendances', month, selectedChildId],
    queryFn: () => getMonthlyAttendances(month, 'ALL'),
    enabled: Boolean(selectedChildId),
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
    setEditingDate(null)
    setEditingItemKey(null)
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
  const attendedDates = useMemo(() => new Set(
    (attendancesQuery.data || [])
      .filter((attendance) => (typeof attendance.children === 'string' ? attendance.children : attendance.children._id) === selectedChildId)
      .flatMap((attendance) => attendance.days.filter((day) => !day.absent && day.status === 'present').map((day) => dateKey(day.date))),
  ), [attendancesQuery.data, selectedChildId])

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
  const exportExcel = async () => {
    if (!selectedChild) return toast.error('Vui lòng chọn trẻ cần xuất kế hoạch')
    const XLSX = await import('xlsx-js-style')
    const categoryExcelColors: Record<string, { fill: string; text: string }> = {
      NHAN_THUC_NGON_NGU: { fill: 'E0F2FE', text: '075985' },
      NHAN_THUC_TU_DUY_MAU_SAC: { fill: 'F3E8FF', text: '6B21A8' },
      TUONG_TAC: { fill: 'FEF3C7', text: '92400E' },
      BAT_CHUOC: { fill: 'FFE4E6', text: '9F1239' },
      VAN_DONG_TINH: { fill: 'D1FAE5', text: '065F46' },
      VAN_DONG_THO: { fill: 'FFEDD5', text: '9A3412' },
    }
    const border = {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    } as const
    const rows = [
      [`KẾ HOẠCH THÁNG ${monthNumber}/${year}`],
      ['Tên trẻ', selectedChild.name],
      ['Tháng học', `${String(monthNumber).padStart(2, '0')}/${year}`],
      [],
      ['Ngày', 'Mục kế hoạch', 'Nội dung'],
      ...monthlyDays.flatMap((day) => {
        const dayDate = dateKey(day.date)
        return PLAN_CATEGORIES.map((category, categoryIndex) => [
          categoryIndex === 0 ? formatPlanDate(dayDate).label : '',
          category.title,
          day.items.find((item) => item.key === category.key)?.content || '',
        ])
      }),
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    rows.forEach((_, rowIndex) => {
      for (let columnIndex = 0; columnIndex < 3; columnIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
        if (!worksheet[address]) worksheet[address] = { t: 's', v: '' }
        worksheet[address].s = { border, alignment: { vertical: 'top', wrapText: true } }
      }
    })
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
      ...monthlyDays.map((_, dayIndex) => ({
        s: { r: 5 + dayIndex * PLAN_CATEGORIES.length, c: 0 },
        e: { r: 5 + dayIndex * PLAN_CATEGORIES.length + PLAN_CATEGORIES.length - 1, c: 0 },
      })),
    ]
    worksheet['!cols'] = [{ wch: 15 }, { wch: 32 }, { wch: 90 }]
    worksheet['!rows'] = rows.map((_, index) => ({ hpt: index === 0 ? 28 : index >= 5 ? 34 : 21 }))

    const titleCell = worksheet.A1
    titleCell.s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '047857' } }, alignment: { horizontal: 'center', vertical: 'center' }, border }
    ;['A2', 'A3'].forEach((address) => { worksheet[address].s = { font: { bold: true, color: { rgb: '065F46' } }, fill: { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } }, alignment: { vertical: 'center' }, border } })
    ;['B2', 'B3', 'C2', 'C3'].forEach((address) => { worksheet[address].s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { vertical: 'center' }, border } })
    ;['A5', 'B5', 'C5'].forEach((address) => { worksheet[address].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center', vertical: 'center' }, border } })
    monthlyDays.forEach((day, dayIndex) => {
      const startRow = 6 + dayIndex * PLAN_CATEGORIES.length
      const { isSaturday, isSunday } = formatPlanDate(dateKey(day.date))
      const dateCell = worksheet[`A${startRow}`]
      dateCell.s = { font: { bold: true, color: { rgb: isSaturday || isSunday ? '92400E' : '334155' } }, fill: { patternType: 'solid', fgColor: { rgb: isSaturday || isSunday ? 'FDE68A' : 'FEF3C7' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border }
      PLAN_CATEGORIES.forEach((category, categoryIndex) => {
        const rowNumber = startRow + categoryIndex
        const colors = categoryExcelColors[category.key]
        worksheet[`B${rowNumber}`].s = { font: { bold: true, color: { rgb: colors.text } }, fill: { patternType: 'solid', fgColor: { rgb: colors.fill } }, alignment: { vertical: 'center', wrapText: true }, border }
        worksheet[`C${rowNumber}`].s = { font: { color: { rgb: '1E293B' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } }, alignment: { vertical: 'top', wrapText: true }, border }
      })
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `Kế hoạch ${monthNumber}-${year}`)
    const safeChildName = selectedChild.name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60) || 'tre'
    XLSX.writeFile(workbook, `Ke-hoach-${safeChildName}-${month}.xlsx`, { compression: true })
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
    <PageHeader eyebrow="Học Sinh" title="Kế hoạch" description="" />
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
              <div className="flex flex-wrap items-center gap-2"><div className="mr-auto"><strong className="block">Toàn bộ kế hoạch Tháng {monthNumber}/{year}</strong><span className="text-xs text-muted">Đủ {totalDays} ngày · {populatedDayCount} ngày có nội dung · {selectedChild?.name}</span></div><Button type="button" size="sm" variant="secondary" onClick={exportExcel}><Download size={14} />Xuất Excel</Button><Button type="button" size="sm" disabled={!isDirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? <Loader2 size={14} className="spin" /> : <Save size={14} />}Lưu kế hoạch</Button></div>
              <Table className="min-w-0 table-fixed sm:min-w-[30rem]" containerClassName="max-h-[calc(100vh-16rem)] overflow-x-hidden overflow-y-auto rounded-xl border border-border sm:overflow-x-auto">
                <TableHeader className="sticky top-0 z-20 bg-surface-muted shadow-sm">
                  <TableRow>
                    <TableHead className="bg-surface-muted">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">Kế hoạch của <strong className="text-primary">{selectedChild?.name}</strong></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y-0">
                  {monthlyDays.map((day) => {
                    const dayDate = dateKey(day.date)
                    const { label, isSaturday, isSunday } = formatPlanDate(dayDate)
                    const hasContent = day.items.some((item) => item.content.trim())
                    const isEditing = editingDate === dayDate
                    const hasAttendance = attendedDates.has(dayDate)
                    return <TableRow key={dayDate} className="align-top border-b-2 border-primary/35 last:border-b-0">
                      <TableCell className="align-top p-0">
                        <button type="button" aria-expanded={isEditing} onClick={() => {
                          setEditingDate(isEditing ? null : dayDate)
                          setEditingItemKey(null)
                        }} className={`flex w-full cursor-pointer items-center gap-2 border-0 px-3 py-2 text-left transition hover:brightness-95 ${hasContent || isEditing ? 'border-b border-border' : ''} ${isSaturday || isSunday ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200' : 'bg-amber-50 text-text-main dark:bg-amber-500/10'}`}>
                          <strong className="whitespace-nowrap text-sm leading-snug">{label}</strong>
                          {hasAttendance && <span className="whitespace-nowrap rounded-md border border-emerald-500 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">Có điểm danh</span>}
                          {!hasContent && !isEditing && <span className="min-w-0 flex-1 truncate text-xs font-normal text-muted">Chưa có kế hoạch</span>}
                          {isEditing ? <ChevronUp size={16} className="ml-auto shrink-0" /> : <ChevronDown size={16} className="ml-auto shrink-0" />}
                        </button>
                        {(hasContent || isEditing) && <div className="p-2 sm:p-3">
                          <div className="grid gap-1.5">{day.items.map((item) => {
                            const inputId = `plan-${dayDate}-${item.key}`
                            const isEditingItem = isEditing && editingItemKey === item.key
                            if (!isEditingItem) return <button key={item.key} type="button" onClick={() => {
                              setEditingDate(dayDate)
                              setEditingItemKey(item.key)
                            }} className="grid min-h-10 grid-cols-[minmax(5.5rem,28%)_1fr] overflow-hidden rounded-md border border-slate-200 bg-white text-left transition hover:border-primary hover:shadow-sm sm:grid-cols-[minmax(6.5rem,28%)_1fr]"><strong className={`flex min-w-0 items-center break-words px-1.5 py-1 text-[10px] leading-tight sm:text-[11px] ${CATEGORY_COLORS[item.key]}`}>{item.title}</strong><p className="m-0 line-clamp-3 min-w-0 self-center whitespace-pre-wrap break-words bg-white px-2 py-1.5 text-xs font-normal leading-snug text-slate-800">{item.content || '—'}</p></button>
                            return <div key={item.key} className={`grid min-w-0 gap-1.5 rounded-md border border-primary p-2 text-sm font-semibold shadow-sm ${CATEGORY_COLORS[item.key]}`}>
                              <div className="flex min-w-0 items-center justify-between gap-2"><label htmlFor={inputId} className="min-w-0 text-xs">{item.title}</label><Button type="button" size="sm" variant="secondary" className="h-7 shrink-0 px-2 text-xs" onClick={() => fillRandomExample(dayDate, item.key)}>Điền mẫu</Button></div>
                              <textarea id={inputId} autoFocus value={item.content} onChange={(event) => updateContent(dayDate, item.key, event.target.value)} rows={3} placeholder="Nhập nội dung hoạt động..." className="min-h-20 w-full resize-y rounded-lg border border-border bg-white/80 p-2.5 text-sm font-normal leading-relaxed text-text-main outline-none focus:border-primary dark:bg-app-background" />
                            </div>
                          })}</div>
                        </div>}
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
