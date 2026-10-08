import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useAuthSession } from '@/stores/auth-store'

export default function DashboardPage() {
  const session = useAuthSession()

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Admin Portal"
        title={`Welcome, ${session.user.name}`}
        description="System overview and platform management."
      />

      <Card className="p-8 text-center text-sm text-muted">
        <p className="m-0 font-medium text-text-main">Dashboard</p>
      </Card>
    </div>
  )
}
