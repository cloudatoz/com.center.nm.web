import { X } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'
import { cx } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity border-0"
        onClick={onClose}
        aria-label="Close modal overlay"
      />
      <div
        className={cx(
          'relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-150',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-text-main">{title}</h3>
            {description && <p className="text-xs text-muted mt-1">{description}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-text-main -mr-2 -mt-2"
          >
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
