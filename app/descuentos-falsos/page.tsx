import { supabaseAdmin } from '@/lib/supabase'
import { BASE_URL, productPath } from '@/lib/seo'
import { formatPrice, flagForSite } from '@/lib/format'

/**
 * Los descuentos con el "antes" inflado que detectamos.
 *
 * Es la página más delicada del sitio: dice que un vendedor publicó un precio
 * que no existió. Por eso muestra la evidencia de cada caso —cuántos precios
 * registramos y cuál fue el percentil 75— en vez de pedir que nos crean, y
 * sólo entra lo que tiene al menos 4 registros en 90 días.
 *
 * Tardó en poder existir. El 18-nov el detector marcaba 0 productos porque el
 * cron de precios había estado roto meses y sólo el 4% del catálogo tenía dos
 * precios para comparar. Una semana de cron después hay 515 casos con
 * evidencia suficiente.
 */

export const revalidate = 1800

const TITULO = 'Descuentos falsos en MercadoLibre — detectados hoy | Lupa Precios'
const DESCRIPCION =
  'Productos donde el precio “antes” que muestra la promoción no coincide con ' +
  'lo que costaban de verdad. Con el historial de precios que lo prueba.'

export const metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: `${BASE_URL}/descuentos-falsos` },
  openGraph: { title: TITULO, description: DESCRIPCION, url: `${BASE_URL}/descuentos-falsos`, type: 'website' }
}

interface Fila {
  ml_item_id: string
  title: string
  thumbnail_url: string | null
  site_id: string | null
  precio: number
  precio_anterior: number
  moneda: string
  detalle: string | null
  registros: number
  visto_en: string
}

export default async function DescuentosFalsosPage() {
  const [{ data: filasRaw }, { data: total }] = await Promise.all([
    supabaseAdmin.rpc('get_descuentos_inflados', { p_limit: 60 }),
    supabaseAdmin.rpc('contar_descuentos_inflados')
  ])

  const filas = (filasRaw as Fila[] | null) ?? []
  const cuantos = typeof total === 'number' ? total : filas.length

  const hoy = new Date().toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <a href="/" className="site-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span>Lupa Precios</span>
          </a>
          <nav className="site-nav">
            <a href="/historial-de-precios" className="nav-link-secondary">Historial de precios</a>
            <a href="/ofertas" className="nav-link-secondary">Ofertas reales</a>
          </nav>
        </div>
      </header>

      <main className="hub">
        <div className="container hub-container df-container">
          <nav className="hub-breadcrumb" aria-label="Migas de pan">
            <a href="/">Inicio</a> <span>›</span> <span>Descuentos falsos</span>
          </nav>

          <h1>Descuentos con el precio “antes” inflado</h1>
          <p className="hub-lead">
            Estos productos muestran una promoción cuyo precio “antes” no
            coincide con lo que venían costando. No es una opinión: abajo de
            cada uno está el historial que lo prueba.
          </p>
          <p className="meto-fecha">
            {cuantos} casos detectados · actualizado el {hoy} ·{' '}
            <a href="/metodologia">cómo lo medimos</a>
          </p>

          {filas.length === 0 ? (
            <p className="hub-alt">
              Ahora mismo no tenemos ningún caso con evidencia suficiente. No
              significa que no haya: significa que todavía no juntamos
              suficientes precios de esos productos para afirmarlo.
            </p>
          ) : (
            <ul className="df-lista">
              {filas.map(f => {
                const exceso = Math.round(((f.precio_anterior - f.precio) / f.precio) * 100)
                return (
                  <li key={f.ml_item_id} className="df-item">
                    <a href={productPath(f.ml_item_id, f.title)} className="df-link">
                      {f.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.thumbnail_url} alt="" width={56} height={56} className="df-thumb" />
                      ) : (
                        <div className="df-thumb df-thumb-vacio" aria-hidden="true" />
                      )}
                      <div className="df-cuerpo">
                        <div className="df-titulo">
                          {f.site_id ? <span className="df-bandera">{flagForSite(f.site_id)}</span> : null}
                          {f.title}
                        </div>
                        <div className="df-precios">
                          <span className="df-antes">{formatPrice(f.precio_anterior, f.moneda)}</span>
                          <span className="df-flecha">→</span>
                          <span className="df-ahora">{formatPrice(f.precio, f.moneda)}</span>
                          <span className="df-badge">“{exceso}% off”</span>
                        </div>
                        {f.detalle && <p className="df-evidencia">{f.detalle}</p>}
                        <div className="df-meta">
                          {f.registros} precios registrados en los últimos 90 días
                        </div>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}

          <section className="hub-section df-aclaracion">
            <h2>Qué significa y qué no</h2>
            <p>
              Un caso en esta lista quiere decir que el precio “antes” anunciado
              está más de un 15% por encima del percentil 75 de lo que ese
              producto costó en los últimos 90 días. Dicho simple: la mayor
              parte del tiempo se vendió bastante más barato que ese “antes”.
            </p>
            <p>
              <strong>No es una acusación de fraude.</strong> Puede haber
              explicaciones legítimas: cambió el vendedor, cambió la
              presentación del producto, o hubo una suba real de precio entre
              medio. Lo que decimos es que el número tachado no describe lo que
              la gente venía pagando, y que con eso el porcentaje de descuento
              pierde sentido.
            </p>
            <p>
              Si sos vendedor y creés que un caso está mal, escribinos: lo
              revisamos y, si el error es nuestro, lo corregimos.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
