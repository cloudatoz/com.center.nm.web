import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListPlus, Loader2, Pencil, Plus, Save, Trash2, WalletCards } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { addCostDetail, createCost, deleteCostDetail, getCosts, updateCostDetail, updateMonthlyCost } from '@/services/apis/costs-api'

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2019 + 2 }, (_, index) => 2020 + index)
const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đ`
const formatMoneyInput = (value: number) => value.toLocaleString('vi-VN')
const parseMoneyInput = (value: string) => Number(value.replace(/\D/g, '')) || 0

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function CostsPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonth)
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAmount, setNewAmount] = useState(0)
  const [detailCostId, setDetailCostId] = useState<string | null>(null)
  const [detailName, setDetailName] = useState('')
  const [detailPrice, setDetailPrice] = useState(0)
  const [editingDetail, setEditingDetail] = useState<{ costId: string; index: number } | null>(null)
  const [editDetailName, setEditDetailName] = useState('')
  const [editDetailPrice, setEditDetailPrice] = useState(0)
  const [selectedYear, selectedMonth] = month.split('-').map(Number)
  const costsQuery = useQuery({ queryKey: ['costs', month], queryFn: () => getCosts(month) })

  useEffect(() => {
    if (costsQuery.data) {
      setAmounts(Object.fromEntries(costsQuery.data.map((cost) => [cost._id, cost.amount])))
    }
  }, [costsQuery.data])

  const mutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => updateMonthlyCost(id, month, amount),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs', month] })
      toast.success('Đã cập nhật chi phí')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể cập nhật chi phí'),
  })
  const createMutation = useMutation({
    mutationFn: () => createCost(newName.trim(), month, newAmount),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs', month] })
      setCreateOpen(false)
      setNewName('')
      setNewAmount(0)
      toast.success('Đã tạo khoản chi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể tạo khoản chi'),
  })
  const detailMutation = useMutation({
    mutationFn: () => addCostDetail(detailCostId!, month, detailName.trim(), detailPrice),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs', month] })
      setDetailName('')
      setDetailPrice(0)
      toast.success('Đã thêm lần chi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể thêm lần chi'),
  })
  const detailCost = costsQuery.data?.find((cost) => cost._id === detailCostId) || null
  const updateDetailMutation = useMutation({
    mutationFn: () => updateCostDetail(editingDetail!.costId, month, editingDetail!.index, editDetailName.trim(), editDetailPrice),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs', month] })
      setEditingDetail(null)
      toast.success('Đã sửa lần chi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể sửa lần chi'),
  })
  const deleteDetailMutation = useMutation({
    mutationFn: ({ costId, index }: { costId: string; index: number }) => deleteCostDetail(costId, month, index),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs', month] })
      toast.success('Đã xóa lần chi')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Không thể xóa lần chi'),
  })
  const total = useMemo(() => Object.values(amounts).reduce((sum, amount) => sum + (amount || 0), 0), [amounts])

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeader
        eyebrow="Chi phí"
        title="Quản lý chi phí"
        description="Theo dõi và cập nhật các khoản chi phí theo từng tháng."
        actions={<Button type="button" onClick={() => setCreateOpen(true)}><Plus size={16} />Tạo khoản chi</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-5"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards size={23} /></span><div><span className="text-xs font-semibold text-muted">Tổng chi phí Tháng {selectedMonth}</span><strong className="mt-1 block text-xl text-text-main">{formatMoney(total)}</strong></div></Card>
        <Card className="flex items-center gap-4 p-5"><div><span className="text-xs font-semibold text-muted">Số khoản chi</span><strong className="mt-1 block text-xl text-text-main">{costsQuery.data?.length || 0}</strong></div></Card>
      </div>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title={`Chi phí Tháng ${selectedMonth}/${selectedYear}`} description="Nhập số tiền và lưu riêng cho từng khoản chi." />
        <div className="flex flex-wrap gap-3 border-b border-border p-4 sm:px-6">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Tháng<select value={selectedMonth} onChange={(event) => setMonth(`${selectedYear}-${String(event.target.value).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{MONTHS.map((value) => <option key={value} value={value}>Tháng {value}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Năm<select value={selectedYear} onChange={(event) => setMonth(`${event.target.value}-${String(selectedMonth).padStart(2, '0')}`)} className="h-10 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-text-main outline-none focus:border-primary">{YEARS.map((value) => <option key={value} value={value}>Năm {value}</option>)}</select></label>
        </div>
        {costsQuery.isLoading && <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted"><Loader2 size={18} className="spin text-primary" />Đang tải chi phí...</div>}
        {costsQuery.isError && <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{costsQuery.error instanceof Error ? costsQuery.error.message : 'Không thể tải chi phí'}</div>}
        {costsQuery.isSuccess && (
          <Table>
            <TableHeader><TableRow><TableHead>Khoản chi</TableHead><TableHead>Số tiền</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>
              {costsQuery.data.map((cost) => (
                <Fragment key={cost._id}>
                  <TableRow>
                    <TableCell className="font-semibold">{cost.name}</TableCell>
                    <TableCell><div className="relative max-w-xs"><input type="text" inputMode="numeric" value={formatMoneyInput(amounts[cost._id] ?? 0)} onChange={(event) => setAmounts((current) => ({ ...current, [cost._id]: parseMoneyInput(event.target.value) }))} className="h-10 w-full rounded-xl border border-border bg-app-background px-3 pr-10 text-sm font-medium outline-none focus:border-primary" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">đ</span></div></TableCell>
                    <TableCell><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setDetailCostId(cost._id)}><ListPlus size={14} />Thêm lần chi</Button><Button type="button" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: cost._id, amount: amounts[cost._id] || 0 })}>{mutation.isPending && mutation.variables?.id === cost._id ? <Loader2 size={14} className="spin" /> : <Save size={14} />}Lưu</Button></div></TableCell>
                  </TableRow>
                  {cost.details.length > 0 && (
                    <TableRow className="bg-app-background/60 hover:bg-app-background/60">
                      <TableCell colSpan={3} className="px-6 py-3">
                        <div className="ml-3 grid gap-2 border-l-2 border-primary/25 pl-4">
                          {cost.details.map((detail, index) => (
                            <div key={`${detail.name}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                              <span className="text-muted">{detail.name}</span>
                              <div className="flex items-center gap-2"><span className="font-semibold text-text-main">{formatMoney(detail.price)}</span><Button type="button" size="icon" title="Sửa lần chi" onClick={() => { setEditingDetail({ costId: cost._id, index }); setEditDetailName(detail.name); setEditDetailPrice(detail.price) }}><Pencil size={14} /></Button><Button type="button" size="icon" title="Xóa lần chi" className="hover:text-red-600" disabled={deleteDetailMutation.isPending} onClick={() => { if (window.confirm(`Xóa lần chi “${detail.name}”?`)) deleteDetailMutation.mutate({ costId: cost._id, index }) }}><Trash2 size={14} /></Button></div>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Modal open={createOpen} onClose={() => !createMutation.isPending && setCreateOpen(false)} title="Tạo khoản chi" description={`Áp dụng cho Tháng ${selectedMonth}/${selectedYear}`}>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!newName.trim()) return toast.error('Vui lòng nhập tên khoản chi')
            createMutation.mutate()
          }}
        >
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Tên khoản chi<input autoFocus maxLength={150} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ví dụ: Tiền thuê nhà" className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Số tiền<input type="text" inputMode="numeric" value={formatMoneyInput(newAmount)} onChange={(event) => setNewAmount(parseMoneyInput(event.target.value))} className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" disabled={createMutation.isPending} onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="submit" disabled={createMutation.isPending || !newName.trim()}>{createMutation.isPending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}Tạo khoản chi</Button></div>
        </form>
      </Modal>
      <Modal open={Boolean(detailCost)} onClose={() => !detailMutation.isPending && setDetailCostId(null)} title={`Chi tiết - ${detailCost?.name || ''}`} description={`Các lần chi trong Tháng ${selectedMonth}/${selectedYear}`}>
        <div className="grid gap-4">
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
            {detailCost?.details.length ? detailCost.details.map((detail, index) => <div key={`${detail.name}-${index}`} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"><span className="text-sm font-medium text-text-main">{detail.name}</span><strong className="whitespace-nowrap text-sm text-text-main">{formatMoney(detail.price)}</strong></div>) : <p className="m-0 px-4 py-6 text-center text-sm text-muted">Chưa có lần chi nào trong tháng này.</p>}
          </div>
          <form className="grid gap-3 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (!detailName.trim()) return toast.error('Vui lòng nhập nội dung chi'); detailMutation.mutate() }}>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Nội dung chi<input autoFocus maxLength={150} value={detailName} onChange={(event) => setDetailName(event.target.value)} placeholder="Ví dụ: Mua túi rác, nước lau sàn..." className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted">Số tiền<input type="text" inputMode="numeric" value={formatMoneyInput(detailPrice)} onChange={(event) => setDetailPrice(parseMoneyInput(event.target.value))} className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
            <div className="flex justify-end"><Button type="submit" disabled={detailMutation.isPending || !detailName.trim()}>{detailMutation.isPending ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}Thêm lần chi</Button></div>
          </form>
        </div>
      </Modal>
      <Modal open={Boolean(editingDetail)} onClose={() => !updateDetailMutation.isPending && setEditingDetail(null)} title="Sửa lần chi" description={`Tháng ${selectedMonth}/${selectedYear}`}>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (!editDetailName.trim()) return toast.error('Vui lòng nhập nội dung chi'); updateDetailMutation.mutate() }}>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Nội dung chi<input autoFocus maxLength={150} value={editDetailName} onChange={(event) => setEditDetailName(event.target.value)} className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">Số tiền<input type="text" inputMode="numeric" value={formatMoneyInput(editDetailPrice)} onChange={(event) => setEditDetailPrice(parseMoneyInput(event.target.value))} className="h-10 rounded-xl border border-border bg-app-background px-3 text-sm font-medium text-text-main outline-none focus:border-primary" /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={updateDetailMutation.isPending} onClick={() => setEditingDetail(null)}>Hủy</Button><Button type="submit" disabled={updateDetailMutation.isPending || !editDetailName.trim()}>{updateDetailMutation.isPending ? <Loader2 size={16} className="spin" /> : <Save size={16} />}Lưu thay đổi</Button></div>
        </form>
      </Modal>
    </div>
  )
}
