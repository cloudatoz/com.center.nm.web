import type { ChildAge } from '@/services/apis/children-api'
import { PLAN_CATEGORIES } from '@/services/apis/plan-api'

const fieldName = (id: string) => `planAge_${id}`

export function readChildAges(form: FormData): ChildAge[] {
  return PLAN_CATEGORIES.flatMap(({ key }) => {
    const value = String(form.get(fieldName(key)) || '').trim()
    if (!value) return []
    const age = Number(value)
    return Number.isFinite(age) ? [{ id: key, age }] : []
  })
}

export function ChildAgeEditor({ initial = [] }: { initial?: ChildAge[] }) {
  const values = new Map(initial.map((item) => [item.id, item.age]))
  return <section className="grid gap-3 rounded-xl border border-border bg-surface-muted/50 p-3 sm:col-span-2 sm:p-4">
    <div><strong className="text-sm">Độ tuổi theo mục kế hoạch</strong><span className="mt-0.5 block text-xs font-normal text-muted">Dùng để chọn nội dung mẫu đúng khả năng của trẻ.</span></div>
    <div className="grid gap-3 sm:grid-cols-2">{PLAN_CATEGORIES.map((category) => <label key={category.key} className="grid min-w-0 gap-1.5 text-xs font-semibold">
      <span className="truncate" title={category.title}>{category.title}</span>
      <select name={fieldName(category.key)} defaultValue={values.get(category.key) ?? 3} className="h-10 w-full rounded-xl border border-border bg-app-background px-3 text-sm font-normal outline-none focus:border-primary">
        {[3, 4, 5, 6].map((age) => <option key={age} value={age}>{age} tuổi</option>)}
      </select>
    </label>)}</div>
  </section>
}
