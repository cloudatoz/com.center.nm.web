import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminShell } from '@/layouts/admin-shell'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'
import { loginTeacherByCode } from '@/services/apis/auth-api'

const LoginPage = lazy(() => import('@/pages/auth/login'))
const DashboardPage = lazy(() => import('@/pages/app/dashboard'))
const StudentsPage = lazy(() => import('@/pages/app/students'))
const StudentHistoryPage = lazy(() => import('@/pages/app/students/history'))
const StudentReceiptsPage = lazy(() => import('@/pages/app/students/receipts'))
const StudentPlansPage = lazy(() => import('@/pages/app/students/plans'))
const TeachersPage = lazy(() => import('@/pages/app/teachers'))
const TeacherHistoryPage = lazy(() => import('@/pages/app/teachers/history'))
const TeacherPaymentsPage = lazy(() => import('@/pages/app/teachers/payments'))
const CostsPage = lazy(() => import('@/pages/app/costs'))
const NotFoundPage = lazy(() => import('@/pages/error/not-found'))

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-app-background text-primary">
      <Loader2 className="spin" size={26} />
    </div>
  )
}

function RootRedirect() {
  const session = useAuthStore((state) => state.session)
  return <Navigate to={session ? session.user.role === 'teacher' ? '/students/history' : '/dashboard' : '/login'} replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((state) => state.session)
  return session ? <Navigate to={session.user.role === 'teacher' ? '/students/history' : '/dashboard'} replace /> : children
}

function ProtectedRoute() {
  const session = useAuthStore((state) => state.session)
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace />
  if (session.user.role === 'teacher' && !['/students/history', '/students/plans'].includes(location.pathname)) {
    return <Navigate to="/students/history" replace />
  }
  return <AdminShell />
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/history', element: <StudentHistoryPage /> },
      { path: 'students/receipts', element: <StudentReceiptsPage /> },
      { path: 'students/plans', element: <StudentPlansPage /> },
      { path: 'teachers', element: <TeachersPage /> },
      { path: 'teachers/history', element: <TeacherHistoryPage /> },
      { path: 'teachers/payments', element: <TeacherPaymentsPage /> },
      { path: 'costs', element: <CostsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export default function App() {
  const hydrated = useAuthStore((state) => state.hydrated)
  const hydrateAuth = useAuthStore((state) => state.hydrate)
  const hydrateTheme = useThemeStore((state) => state.hydrate)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [teacherLoginPending, setTeacherLoginPending] = useState(false)
  const teacherLoginStarted = useRef(false)

  useEffect(() => {
    hydrateTheme()
    if (!hydrated) hydrateAuth()
  }, [hydrateAuth, hydrateTheme, hydrated])

  useEffect(() => {
    if (!hydrated || teacherLoginStarted.current) return
    const code = new URLSearchParams(window.location.search).get('code')?.trim().toLowerCase()
    if (!code) return
    teacherLoginStarted.current = true
    if (!/^[a-z0-9]{8}$/.test(code)) {
      toast.error('Mã đăng nhập giáo viên không hợp lệ')
      return
    }
    clearSession()
    setTeacherLoginPending(true)
    loginTeacherByCode(code)
      .then((teacherSession) => {
        setSession(teacherSession)
        const url = new URL(window.location.href)
        url.searchParams.delete('code')
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Không thể đăng nhập bằng mã giáo viên'))
      .finally(() => setTeacherLoginPending(false))
  }, [clearSession, hydrated, setSession])

  if (!hydrated || teacherLoginPending) return <LoadingScreen />
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
