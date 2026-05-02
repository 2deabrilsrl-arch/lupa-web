import { supabaseAdmin } from './supabase'
import { sendPriceAlert } from './email'

const COOLDOWN_MS = 24 * 60 * 60 * 1000 // don't re-fire the same alert within 24h

interface AlertRow {
  id: number
  user_id: string
  item_id: number
  target_price: number
  alert_type: 'below' | 'drop_percent' | 'any_change'
  drop_percent: number | null
  triggered_at: string | null
}

interface ItemRow {
  id: number
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  permalink: string | null
}

interface UserRow {
  id: string
  email: string | null
  display_name: string | null
}

function shouldFire(alert: AlertRow, currentPrice: number, previousPrice: number | null): boolean {
  switch (alert.alert_type) {
    case 'below':
      return currentPrice <= Number(alert.target_price)
    case 'drop_percent':
      if (previousPrice == null || alert.drop_percent == null) return false
      const drop = ((previousPrice - currentPrice) / previousPrice) * 100
      return drop >= Number(alert.drop_percent)
    case 'any_change':
      return previousPrice != null && currentPrice !== previousPrice
    default:
      return false
  }
}

/**
 * Evaluate alerts for a single item after a price update.
 * Sends emails and records notifications. Idempotent within COOLDOWN_MS.
 */
export async function processAlertsForItem(
  itemId: number,
  currentPrice: number,
  previousPrice: number | null
): Promise<{ fired: number; skipped: number }> {
  const { data: alerts, error } = await supabaseAdmin
    .from('alerts')
    .select('id, user_id, item_id, target_price, alert_type, drop_percent, triggered_at')
    .eq('item_id', itemId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .returns<AlertRow[]>()

  if (error || !alerts || alerts.length === 0) return { fired: 0, skipped: 0 }

  const matching = alerts.filter(a => shouldFire(a, currentPrice, previousPrice))
  if (matching.length === 0) return { fired: 0, skipped: 0 }

  // Load item + min price + users in parallel
  const [{ data: item }, { data: minRow }] = await Promise.all([
    supabaseAdmin
      .from('items')
      .select('id, ml_item_id, title, thumbnail_url, permalink')
      .eq('id', itemId)
      .single<ItemRow>(),
    supabaseAdmin
      .from('price_history')
      .select('price')
      .eq('item_id', itemId)
      .order('price', { ascending: true })
      .limit(1)
      .maybeSingle<{ price: number }>()
  ])

  if (!item) return { fired: 0, skipped: matching.length }

  const minPrice = minRow ? Number(minRow.price) : currentPrice
  const productUrl =
    item.permalink ?? `https://www.mercadolibre.com.ar/p/${item.ml_item_id}`

  let fired = 0
  let skipped = 0

  for (const alert of matching) {
    // Cooldown check
    if (alert.triggered_at) {
      const last = new Date(alert.triggered_at).getTime()
      if (Date.now() - last < COOLDOWN_MS) {
        skipped++
        continue
      }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name')
      .eq('id', alert.user_id)
      .is('deleted_at', null)
      .maybeSingle<UserRow>()

    if (!user?.email) {
      skipped++
      continue
    }

    try {
      await sendPriceAlert({
        to: user.email,
        userName: user.display_name,
        productTitle: item.title,
        productUrl,
        thumbnailUrl: item.thumbnail_url,
        currentPrice,
        targetPrice: Number(alert.target_price),
        minPrice
      })

      await supabaseAdmin
        .from('alerts')
        .update({ triggered_at: new Date().toISOString(), notification_sent: true })
        .eq('id', alert.id)

      await supabaseAdmin.from('alert_notifications').insert({
        alert_id: alert.id,
        user_id: alert.user_id,
        notification_type: 'email',
        status: 'sent',
        metadata: { current_price: currentPrice, target_price: alert.target_price }
      })

      fired++
    } catch (err) {
      console.error('[Alerts] Failed to send', alert.id, err)
      await supabaseAdmin.from('alert_notifications').insert({
        alert_id: alert.id,
        user_id: alert.user_id,
        notification_type: 'email',
        status: 'failed',
        metadata: { error: String(err) }
      })
      skipped++
    }
  }

  return { fired, skipped }
}
