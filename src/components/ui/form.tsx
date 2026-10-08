import { ChevronDown } from 'lucide-react'
import {
  Children,
  cloneElement,
  forwardRef,
  type InputHTMLAttributes,
  isValidElement,
  type ReactElement,
  type SelectHTMLAttributes,
  useId,
} from 'react'
import { cx } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-text-main placeholder:text-muted/60 outline-none transition duration-150 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50 disabled:bg-surface-muted',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        className={cx(
          'h-10 w-full appearance-none rounded-xl border border-border bg-surface pl-3.5 pr-10 text-sm font-medium text-text-main outline-none transition duration-150 focus:border-primary focus:ring-4 focus:ring-primary/10 cursor-pointer disabled:opacity-50 disabled:bg-surface-muted',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  ),
)
Select.displayName = 'Select'

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  const generatedId = useId()
  const child = Children.only(children)
  const childId = isValidElement<{ id?: string }>(child) ? child.props.id : undefined
  const controlId = childId || generatedId
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<{ id?: string }>, { id: controlId })
    : child

  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={controlId} className="text-xs font-semibold text-text-main">
        {label}
      </label>
      {control}
      {(error || hint) && (
        <span
          className={cx(
            'text-[11px] leading-tight',
            error ? 'text-red-500 font-medium' : 'text-muted',
          )}
        >
          {error || hint}
        </span>
      )}
    </div>
  )
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'min-h-24 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text-main placeholder:text-muted/60 outline-none transition duration-150 focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:opacity-50 disabled:bg-surface-muted',
        className,
      )}
      {...props}
    />
  )
}
