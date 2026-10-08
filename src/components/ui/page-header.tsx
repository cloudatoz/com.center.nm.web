export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </span>
        )}
        <h1 className="m-0 mt-1 font-display text-2xl font-extrabold tracking-tight text-text-main sm:text-3xl">
          {title}
        </h1>
        <p className="m-0 mt-2 text-sm leading-relaxed text-muted sm:text-[15px]">{description}</p>
      </div>
      {actions}
    </div>
  )
}
