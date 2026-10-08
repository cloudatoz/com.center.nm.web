import { ArrowLeft, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand-logo'

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-app-background px-5 text-center">
      <div className="max-w-md">
        <BrandLogo className="mb-10 justify-center" />
        <SearchX className="mx-auto text-accent" size={48} />
        <h1 className="mt-5 font-display text-3xl font-extrabold text-text-main">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          The administrative route you requested does not exist or may have been relocated.
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
