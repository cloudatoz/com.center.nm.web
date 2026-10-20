import { Activity, ShieldCheck, Terminal, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-app-background lg:grid-cols-[minmax(480px,1fr)_1.25fr]">
      {/* Left Column: Auth Form Area */}
      <section className="relative z-10 flex min-h-screen flex-col justify-between bg-surface px-6 py-8 sm:px-12 sm:py-10 lg:px-16 xl:px-20 shadow-xl border-r border-border/60">
        <header className="flex items-center justify-between">
          <BrandLogo />
          <ThemeToggle />
        </header>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 items-center py-10 sm:py-12">
          {children}
        </div>

        <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/60 pt-6 text-[12px] text-muted">
          <span>© 2026 NM Quản lý</span>
        </footer>
      </section>

      {/* Right Column: Platform Governance & Admin Showcase */}
      <section
        className="relative hidden lg:flex min-h-screen flex-col justify-between items-center overflow-hidden bg-[#05070A] p-8 xl:p-12 text-white select-none"
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-[450px] w-[450px] rounded-full bg-[#0080F3]/20 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-[450px] w-[450px] rounded-full bg-[#00C6FF]/15 blur-[130px]" />

        <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col items-center justify-center text-left relative z-10 my-auto">
          <div className="w-full text-left mb-6">
            <span className="text-[#00C6FF] font-mono text-xs font-bold uppercase tracking-wider block mb-1">
              OPERATIONS & GOVERNANCE
            </span>
            <h2 className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Centralized Gateway Command Center
            </h2>
            <p className="text-white/70 text-xs xl:text-sm mt-2 leading-relaxed max-w-xl">
              Monitor network health, govern merchant onboarding, audit ledger transactions, and
              configure provider routing parameters across global endpoints.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 w-full">
            <div className="bg-[#030913] border border-[#0066FF]/60 rounded-2xl p-4 flex flex-col justify-start transition-all duration-300 hover:border-[#00C6FF] hover:shadow-[0_0_20px_rgba(0,198,255,0.2)]">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-primary mb-3">
                <Users size={20} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Merchant Directory</h4>
              <p className="text-[11px] text-white/70 leading-snug">
                Manage partner entities, verify KYC tiers, enforce rate limits, and audit access
                credentials.
              </p>
            </div>

            <div className="bg-[#030913] border border-[#0066FF]/60 rounded-2xl p-4 flex flex-col justify-start transition-all duration-300 hover:border-[#00C6FF] hover:shadow-[0_0_20px_rgba(0,198,255,0.2)]">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3">
                <Activity size={20} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Live Transaction Oversight</h4>
              <p className="text-[11px] text-white/70 leading-snug">
                Real-time transaction tracing, settlement reconciliation, and webhook dispatch
                inspection.
              </p>
            </div>

            <div className="bg-[#030913] border border-[#0066FF]/60 rounded-2xl p-4 flex flex-col justify-start transition-all duration-300 hover:border-[#00C6FF] hover:shadow-[0_0_20px_rgba(0,198,255,0.2)]">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3">
                <ShieldCheck size={20} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Role-Based Access</h4>
              <p className="text-[11px] text-white/70 leading-snug">
                Granular administrative privileges, superadmin controls, operator roles, and
                immutable audit logs.
              </p>
            </div>

            <div className="bg-[#030913] border border-[#0066FF]/60 rounded-2xl p-4 flex flex-col justify-start transition-all duration-300 hover:border-[#00C6FF] hover:shadow-[0_0_20px_rgba(0,198,255,0.2)]">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3">
                <Terminal size={20} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Routing & Integrations</h4>
              <p className="text-[11px] text-white/70 leading-snug">
                Switch provider gateways, adjust sandbox simulator settings, and inspect system
                telemetry.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
