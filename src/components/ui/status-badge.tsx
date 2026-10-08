import { cx } from '@/lib/utils'

const colorByStatus: Record<string, string> = {
  completed:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  active:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  pending:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  refund:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/30',
  reject:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
  inactive:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
  production:
    'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40 font-bold',
  sandbox:
    'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 font-bold',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const normalized = (status || '').toLowerCase()
  const isSandbox = normalized === 'sandbox'
  const isProduction = normalized === 'production'

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide capitalize backdrop-blur-xs shadow-2xs',
        colorByStatus[normalized] ||
          'border-border bg-surface-muted text-muted dark:bg-slate-800 dark:text-slate-400',
        className,
      )}
    >
      {isSandbox && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
      {isProduction && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
      {status.replace(/_/g, ' ')}
    </span>
  )
}
