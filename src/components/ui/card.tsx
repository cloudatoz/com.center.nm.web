import { cx } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cx(
        'rounded-2xl border border-border bg-surface shadow-xs transition-shadow duration-200',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h2 className="m-0 font-display text-base font-bold text-text-main sm:text-lg">{title}</h2>
        {description && (
          <p className="m-0 mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}
