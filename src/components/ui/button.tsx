import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cx } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
  size?: 'default' | 'sm' | 'icon' | 'compact'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]',
        {
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md':
            variant === 'primary',
          'border border-border bg-surface text-text-main shadow-xs hover:border-border-strong hover:bg-surface-muted':
            variant === 'secondary',
          'bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:ring-red-500':
            variant === 'danger',
          'bg-transparent text-muted hover:bg-surface-muted hover:text-text-main':
            variant === 'ghost',
          'h-9 w-9 p-0 rounded-lg border-0 bg-transparent text-muted hover:bg-surface-muted hover:text-text-main':
            variant === 'icon' || size === 'icon',
          'h-10 px-4 py-2': size === 'default' && variant !== 'icon',
          'h-9 px-3.5 py-1.5': size === 'compact' && variant !== 'icon',
          'h-8 rounded-lg px-3 text-xs': size === 'sm' && variant !== 'icon',
        },
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
