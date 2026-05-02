import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import DashboardClient, { type TrackedItem } from './DashboardClient'

export const metadata = {
  title: 'Mi panel — Lupa Precios',
  robots: { index: false, follow: false }
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/api/auth/login')
  }

  const { data: items } = await supabaseAdmin.rpc('get_dashboard_items', { p_limit: 500 })

  const { count: alertsCount } = await supabaseAdmin
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  const { count: totalItems } = await supabaseAdmin
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('deleted_at', null)

  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <a href="/" className="site-brand">
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span>Lupa Precios</span>
          </a>
          <nav className="site-nav dashboard-nav">
            <span className="nav-greeting">
              Hola, <strong>{user.ml_nickname || user.display_name || 'usuario'}</strong>
            </span>
            <a href="/api/auth/logout" className="nav-login nav-logout">Cerrar sesión</a>
          </nav>
        </div>
      </header>

      <main className="dashboard">
        <div className="container dashboard-container">
          <div className="dashboard-stats">
            <div className="stat-card">
              <div className="stat-label">Productos trackeados</div>
              <div className="stat-value">{totalItems ?? items?.length ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Mis alertas activas</div>
              <div className="stat-value">{alertsCount ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Plan</div>
              <div className="stat-value plan-value">{user.plan}</div>
            </div>
          </div>

          <DashboardClient items={(items as TrackedItem[]) ?? []} />
        </div>
      </main>
    </>
  )
}
