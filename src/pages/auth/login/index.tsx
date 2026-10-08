import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { AuthLayout } from '../auth-layout'
import { useLogin } from './hooks/use-login'

export default function LoginPage() {
  const form = useLogin()
  const [rememberMe, setRememberMe] = useState(true)
  const pending = form.loginMutation.isPending

  return (
    <AuthLayout>
      <div className="w-full">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase text-primary mb-3">
            <ShieldAlert size={13} />
            Restricted Access
          </div>
          <h1 className="m-0 font-display text-3xl sm:text-[36px] font-extrabold leading-[1.1] tracking-tight text-text-main">
            Admin Sign In
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-muted">
            Enter administrative credentials to access operations telemetry and governance tools.
          </p>
        </div>

        <form
          className="mt-7 grid gap-4.5"
          onSubmit={(event) => {
            event.preventDefault()
            form.submit()
          }}
        >
          <Field label="Admin email" error={form.errors.email}>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-muted pointer-events-none" size={16} />
              <Input
                type="email"
                autoComplete="email"
                placeholder="admin@vego.mobi"
                className="pl-10"
                value={form.email}
                onChange={(event) => form.setEmail(event.target.value)}
              />
            </div>
          </Field>

          <Field label="Password" error={form.errors.password}>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-muted pointer-events-none" size={16} />
              <Input
                type={form.showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter admin password"
                className="pl-10 pr-11"
                value={form.password}
                onChange={(event) => form.setPassword(event.target.value)}
              />
              <button
                type="button"
                aria-label={form.showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted transition-colors hover:bg-surface-muted hover:text-text-main"
                onClick={() => form.setShowPassword(!form.showPassword)}
              >
                {form.showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-muted hover:text-text-main transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
              />
              <span>Remember this workstation</span>
            </label>
            <span className="text-muted hover:text-primary cursor-pointer transition-colors font-medium">
              Trouble logging in?
            </span>
          </div>

          <Button
            type="submit"
            className="mt-2 h-11 w-full text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all cursor-pointer"
            disabled={pending}
          >
            {form.loginMutation.isPending ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            Sign in to Console
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
