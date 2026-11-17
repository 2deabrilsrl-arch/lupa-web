import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import AlertaClient from './AlertaClient'

export const metadata = {
  title: 'Crear alerta — Lupa Precios',
  robots: { index: false, follow: false }
}

export const dynamic = 'force-dynamic'

interface ItemRow {
  id: number
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  permalink: string | null
}

/**
 * Aterrizaje del botón "Avisame si baja" de la extensión.
 *
 * Hasta ahora la única forma de crear una alerta era entrar al panel y
 * buscar el producto ahí: en toda la historia de la app se crearon 6. El
 * usuario está mirando el producto en MercadoLibre, no en nuestro panel, así
 * que la alerta tiene que poder nacer desde ahí con el precio ya cargado.
 */
export default async function AlertaPage({
  searchParams
}: {
  searchParams: Promise<{ ml?: string; precio?: string }>
}) {
  const { ml, precio } = await searchParams

  const mlItemId = (ml ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}U?[0-9]+$/.test(mlItemId)) {
    redirect('/dashboard')
  }

  const user = await getSessionUser()
  if (!user) {
    // Volvemos acá después del login de ML, con el producto y el precio
    // intactos. Sin esto el usuario caía en el panel y había que buscar el
    // producto de nuevo a mano, que es justamente lo que queremos evitar.
    const destino = `/alerta?ml=${encodeURIComponent(mlItemId)}` +
      (precio ? `&precio=${encodeURIComponent(precio)}` : '')
    redirect(`/api/auth/login?next=${encodeURIComponent(destino)}`)
  }

  const { data: item } = await supabaseAdmin
    .from('items')
    .select('id, ml_item_id, title, thumbnail_url, permalink')
    .eq('ml_item_id', mlItemId)
    .is('deleted_at', null)
    .maybeSingle<ItemRow>()

  if (!item) {
    return (
      <main className="dashboard">
        <div className="container dashboard-container">
          <h1>Todavía no conocemos este producto</h1>
          <p>
            Abrilo una vez en MercadoLibre con la extensión instalada y volvé a
            intentarlo: ahí lo empezamos a seguir.
          </p>
          <p><a href="/dashboard">Ir a mi panel</a></p>
        </div>
      </main>
    )
  }

  const { data: ultimo } = await supabaseAdmin
    .from('price_history')
    .select('price, currency')
    .eq('item_id', item.id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ price: number; currency: string | null }>()

  const { data: minimo } = await supabaseAdmin
    .from('price_history')
    .select('price')
    .eq('item_id', item.id)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle<{ price: number }>()

  const { data: existente } = await supabaseAdmin
    .from('alerts')
    .select('id, target_price')
    .eq('user_id', user.id)
    .eq('item_id', item.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle<{ id: number; target_price: number }>()

  const precioParam = Number(precio)
  const sugerido = Number.isFinite(precioParam) && precioParam > 0
    ? Math.round(precioParam)
    : minimo
      ? Math.round(Number(minimo.price))
      : ultimo
        ? Math.round(Number(ultimo.price) * 0.9)
        : 0

  return (
    <AlertaClient
      itemId={item.id}
      title={item.title}
      thumbnailUrl={item.thumbnail_url}
      permalink={item.permalink ?? `https://www.mercadolibre.com.ar/p/${item.ml_item_id}`}
      currency={ultimo?.currency ?? 'ARS'}
      precioActual={ultimo ? Number(ultimo.price) : null}
      precioMinimo={minimo ? Number(minimo.price) : null}
      sugerido={sugerido}
      yaExiste={existente ? Number(existente.target_price) : null}
      email={user.email || null}
    />
  )
}
