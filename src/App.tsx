import { Loader2 } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AdminShell } from '@/layouts/admin-shell'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeStore } from '@/stores/theme-store'

const LoginPage = lazy(() => import('@/pages/auth/login'))
const DashboardPage = lazy(() => import('@/pages/app/dashboard'))
const StudentsPage = lazy(() => import('@/pages/app/students'))
const StudentHistoryPage = lazy(() => import('@/pages/app/students/history'))
const StudentReceiptsPage = lazy(() => import('@/pages/app/students/receipts'))
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
  return <Navigate to={session ? '/dashboard' : '/login'} replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((state) => state.session)
  return session ? <Navigate to="/dashboard" replace /> : children
}

function ProtectedRoute() {
  const session = useAuthStore((state) => state.session)
  return session ? <AdminShell /> : <Navigate to="/login" replace />
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

  useEffect(() => {
    hydrateTheme()
    if (!hydrated) hydrateAuth()
  }, [hydrateAuth, hydrateTheme, hydrated])

  if (!hydrated) return <LoadingScreen />
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
