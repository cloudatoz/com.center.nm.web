import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand-logo'

export default function ForbiddenPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background px-5 text-center">
      <div className="max-w-md">
        <BrandLogo className="mb-10 justify-center" />
        <ShieldAlert className="mx-auto text-rose-500" size={48} />
        <h1 className="mt-5 font-display text-3xl font-extrabold text-text-main">
          Access Restricted
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your current administrator role does not possess the permissions required to view this
          area.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white no-underline hover:bg-primary-hover transition-colors"
        >
          <ArrowLeft size={16} /> Return to Console
        </Link>
      </div>
    </main>
  )
}
