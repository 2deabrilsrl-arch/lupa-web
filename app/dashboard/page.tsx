import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import DashboardClient, { type TrackedItem, type UserAlert, type UserPrefs } from './DashboardClient'

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

  // User's active alerts joined with item info
  const { data: alertsRaw } = await supabaseAdmin
    .from('alerts')
    .select(
      'id, target_price, alert_type, drop_percent, created_at, triggered_at, items(id, ml_item_id, title, thumbnail_url, site_id)'
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const alerts: UserAlert[] = ((alertsRaw ?? []) as unknown as Array<{
    id: number
    target_price: number
    alert_type: string
    drop_percent: number | null
    created_at: string
    triggered_at: string | null
    items: {
      id: number
      ml_item_id: string
      title: string
      thumbnail_url: string | null
      site_id: string | null
    } | null
  }>)
    .filter(a => a.items != null)
    .map(a => ({
      id: a.id,
      target_price: Number(a.target_price),
      alert_type: a.alert_type,
      drop_percent: a.drop_percent,
      created_at: a.created_at,
      triggered_at: a.triggered_at,
      item_id: a.items!.id,
      ml_item_id: a.items!.ml_item_id,
      title: a.items!.title,
      thumbnail_url: a.items!.thumbnail_url,
      site_id: a.items!.site_id
    }))

  // User preferences (extra fields not in session)
  const { data: prefsRaw } = await supabaseAdmin
    .from('users')
    .select('notification_email, display_name')
    .eq('id', user.id)
    .maybeSingle<{ notification_email: string | null; display_name: string | null }>()

  const prefs: UserPrefs = {
    notification_email: prefsRaw?.notification_email ?? null,
    display_name: prefsRaw?.display_name ?? null,
    ml_email: user.email ?? null
  }

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

          <DashboardClient
            items={(items as TrackedItem[]) ?? []}
            alerts={alerts}
            prefs={prefs}
          />
        </div>
      </main>
    </>
  )
}
