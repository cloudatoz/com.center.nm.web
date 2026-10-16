import { useState } from 'react'
import { CHILD_TYPE_OPTIONS, childTypeLabel, emptyTypeConfig } from '@/lib/child-pricing'
import type { ChildTypeCode, ChildTypeConfig } from '@/services/apis/children-api'
import type { Teacher } from '@/services/apis/teachers-api'

const inputClass = 'h-10 w-full min-w-0 rounded-xl border border-border bg-app-background px-3 font-normal outline-none focus:border-primary'
const DAYS_OF_WEEK = ['thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7', 'chủ nhật']

export function readTypeConfigs(form: FormData): ChildTypeConfig[] {
  return form.getAll('selectedType').map(String).map((typeValue) => {
    const type = typeValue as ChildTypeCode
    return {
      type,
      price: Number(form.get(`${type}.price`)) || 0,
      prices: {
        tuition: Number(form.get(`${type}.tuition`)) || 0,
        csvc: Number(form.get(`${type}.csvc`)) || 0,
        meal: Number(form.get(`${type}.meal`)) || 0,
      },
      teacherId: String(form.get(`${type}.teacherId`) || '') || null,
      teacherName: '',
      teacherPrice: Number(form.get(`${type}.teacherPrice`)) || 0,
      scheduleInWeek: form.getAll(`${type}.scheduleInWeek`).map(String),
    }
  })
}

export function ChildTypeEditor({ initial, teachers }: { initial: ChildTypeConfig[]; teachers: Teacher[] }) {
  const [selected, setSelected] = useState<ChildTypeCode[]>(() => initial.length ? initial.map((item) => item.type) : ['CA_NGAY'])
  const toggle = (type: ChildTypeCode, checked: boolean) => {
    const next = checked ? [...new Set([...selected, type])] : selected.filter((item) => item !== type)
    setSelected(next)
  }
  return <fieldset className="grid min-w-0 gap-3"><legend className="mb-1 text-sm font-semibold">Loại học và học phí</legend>
    <div className="flex flex-wrap gap-2">{CHILD_TYPE_OPTIONS.map(({ type, label }) => <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${selected.includes(type) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-app-background'}`}><input name="selectedType" type="checkbox" value={type} checked={selected.includes(type)} onChange={(event) => toggle(type, event.target.checked)} />{label}</label>)}</div>
    {selected.map((type) => {
      const config = initial.find((item) => item.type === type) || emptyTypeConfig(type)
      return <div key={type} className="grid min-w-0 gap-4 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
        <strong className="sm:col-span-2 lg:col-span-3">{childTypeLabel(type)}</strong>
        {type === 'CA_NGAY' ? <>
          <label className="grid gap-1.5 text-sm font-semibold">Học phí tháng<input name={`${type}.tuition`} type="number" min="0" step="1000" defaultValue={config.prices.tuition} className={inputClass} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Phí CSVC<input name={`${type}.csvc`} type="number" min="0" step="1000" defaultValue={config.prices.csvc} className={inputClass} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Tiền ăn<input name={`${type}.meal`} type="number" min="0" step="1000" defaultValue={config.prices.meal} className={inputClass} /></label>
        </> : <>
          <label className="grid gap-1.5 text-sm font-semibold">Học phí<input name={`${type}.price`} type="number" min="0" step="1000" defaultValue={config.price} className={inputClass} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Giáo viên<select name={`${type}.teacherId`} defaultValue={config.teacherId || ''} className={inputClass}><option value="">Chưa chọn giáo viên</option>{teachers.filter((teacher) => teacher.active).map((teacher) => <option key={teacher._id} value={teacher._id}>{teacher.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold">Lương giáo viên 1h<input name={`${type}.teacherPrice`} type="number" min="0" step="1000" defaultValue={config.teacherPrice} className={inputClass} /></label>
        </>}
        <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
          <span className="text-sm font-semibold">Lịch học trong tuần</span>
          <div className="flex flex-wrap gap-2">{DAYS_OF_WEEK.map((day) => <label key={day} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-app-background px-2.5 py-1.5 text-xs font-medium"><input name={`${type}.scheduleInWeek`} type="checkbox" value={day} defaultChecked={config.scheduleInWeek.includes(day)} />{day}</label>)}</div>
        </div>
      </div>
    })}
  </fieldset>
}
