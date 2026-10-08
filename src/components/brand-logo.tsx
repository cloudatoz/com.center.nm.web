import { cx } from '@/lib/utils'

export function BrandLogo({
  className,
  imgClassName,
  showBadge = true,
}: {
  className?: string
  imgClassName?: string
  showBadge?: boolean
}) {
  return (
    <div
      role="img"
      className={cx('flex items-center gap-2 select-none', className)}
      aria-label="VG Admin"
    >
      <img
        src="/logo-vg.png"
        alt="VG Admin"
        className={cx('h-8 w-auto max-w-[130px] object-contain', imgClassName)}
        loading="eager"
      />
      {showBadge && (
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-primary border border-primary/20">
          Admin
        </span>
      )}
    </div>
  )
}
