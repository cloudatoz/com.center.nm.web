import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandLogo } from '@/components/brand-logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cx } from '@/lib/utils'
import { getCurrentAdmin } from '@/services/apis/auth-api'
import { useAuthStore } from '@/stores/auth-store'
import { ADMIN_NAV_ITEMS, getPageTitle, isNavGroup } from './navigation'

export function AdminShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const item of ADMIN_NAV_ITEMS) {
      if (isNavGroup(item)) {
        if (item.children.some((child) => location.pathname.startsWith(child.to))) {
          initial[item.id] = true
        }
      }
    }
    return initial
  })

  // Auto-expand group if active route changes
  useEffect(() => {
    for (const item of ADMIN_NAV_ITEMS) {
      if (isNavGroup(item)) {
        if (item.children.some((child) => location.pathname.startsWith(child.to))) {
          setOpenGroups((prev) => ({ ...prev, [item.id]: true }))
        }
      }
    }
  }, [location.pathname])

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const adminQuery = useQuery({
    queryKey: ['current-admin'],
    queryFn: () => {
      if (!session) throw new Error('Authenticated session is required')
      return getCurrentAdmin(session)
    },
    enabled: Boolean(session),
  })

  useEffect(() => {
    if (adminQuery.data) setSession(adminQuery.data)
  }, [setSession, adminQuery.data])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: close menus on navigation
  useEffect(() => {
    setUserMenuOpen(false)
    setMobileMenuOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    setUserMenuOpen(false)
    clearSession()
    queryClient.clear()
    toast.success('Signed out successfully')
    navigate('/login', { replace: true })
  }

  const currentUser = adminQuery.data?.user || session?.user
  const displayName = currentUser?.name || currentUser?.email || 'Admin'
  const userInitial = displayName.charAt(0).toUpperCase()
  const roleLabel = (currentUser?.role || 'admin').toUpperCase()

  return (
    <div className="flex min-h-screen bg-app-background text-text-main">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 border-0 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-border bg-surface text-text-main transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className="flex h-[64px] items-center justify-between border-b border-border px-5">
          <BrandLogo />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>

        <div className="px-5 pb-2 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Administration Portal
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4" aria-label="Admin navigation">
          {ADMIN_NAV_ITEMS.map((item) => {
            if (isNavGroup(item)) {
              const isGroupActive = item.children.some((child) =>
                location.pathname.startsWith(child.to),
              )
              const isOpen = Boolean(openGroups[item.id])

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.id)}
                    className={cx(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 border-0 bg-transparent cursor-pointer text-left',
                      isGroupActive
                        ? 'text-primary font-semibold'
                        : 'text-slate-600 hover:bg-surface-muted hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                    )}
                  >
                    <item.icon
                      size={18}
                      className={cx(
                        'shrink-0 transition-colors',
                        isGroupActive ? 'text-primary' : 'text-slate-500 dark:text-slate-400',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={cx(
                        'shrink-0 text-muted transition-transform duration-200',
                        isOpen && 'rotate-180 text-text-main',
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-4 space-y-1 border-l border-border/80 pl-3">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.id}
                          to={child.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            cx(
                              'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium no-underline transition-all duration-150',
                              isActive
                                ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                                : 'text-slate-600 hover:bg-surface-muted hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                            )
                          }
                        >
                          <child.icon size={15} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          <ChevronRight
                            size={12}
                            className="opacity-0 transition-opacity duration-150 group-hover:opacity-60"
                          />
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={item.id}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cx(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium no-underline transition-all duration-150',
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-surface-muted hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                  )
                }
              >
                <item.icon size={18} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight
                  size={14}
                  className="opacity-0 transition-opacity duration-150 group-hover:opacity-60"
                />
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted sm:hidden">
                VG Admin
              </span>
              <h1 className="m-0 truncate font-display text-base font-bold text-text-main sm:text-lg">
                {getPageTitle(location.pathname)}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {/* Header User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                id="header-user-menu-btn"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className={cx(
                  'flex items-center gap-1.5 sm:gap-2 rounded-xl border border-border/80 bg-surface p-1 sm:px-2.5 sm:py-1.5 transition-all duration-150 hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
                  userMenuOpen && 'border-primary/40 bg-surface-muted ring-2 ring-primary/10',
                )}
              >
                <div className="grid h-7 w-7 sm:h-7.5 sm:w-7.5 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary dark:bg-primary/20">
                  {userInitial}
                </div>
                <div className="hidden max-w-[130px] text-left sm:inline-block">
                  <span className="block truncate text-xs font-semibold text-text-main">
                    {displayName}
                  </span>
                  <span className="block text-[10px] font-medium text-muted">{roleLabel}</span>
                </div>
                <ChevronDown
                  size={13}
                  className={cx(
                    'text-muted transition-transform duration-200 hidden sm:block',
                    userMenuOpen && 'rotate-180 text-text-main',
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface/95 p-1.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-100 z-50">
                  {/* User Profile Header */}
                  <div className="flex items-center gap-3 rounded-xl bg-surface-muted/60 p-3 mb-1">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-blue-600 text-sm font-extrabold text-white shadow-sm">
                      {userInitial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs font-bold text-text-main">
                        {displayName}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {currentUser?.email}
                      </span>
                    </div>
                  </div>

                  <div className="my-1 border-t border-border/60" />

                  {/* Logout Button */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 cursor-pointer border-0 bg-transparent"
                  >
                    <LogOut size={15} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
