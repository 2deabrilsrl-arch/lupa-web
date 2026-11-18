import { supabaseAdmin } from '@/lib/supabase'
import { BASE_URL, slugify } from '@/lib/seo'
import { installUrl } from '@/lib/config'

/**
 * Hub de "historial de precios".
 *
 * Search Console al 17-nov-2026: 62 clics en 90 días, y los que llegan por
 * consultas de intención ("historial precios mercadolibre", "mercado libre
 * tracker precios") lo hacen con 6 y 1 impresiones. O sea: hay demanda y el
 * sitio no tenía UNA SOLA página que respondiera esa búsqueda. Las fichas de
 * producto consiguen impresiones y cero clics, porque compiten contra la
 * publicación de ML por el nombre del producto y pierden.
 *
 * Esta página no compite con ML: responde algo que ML nunca va a responder.
 */

export const revalidate = 3600

const TITULO = 'Historial de precios de MercadoLibre — gratis y sin registro'
const DESCRIPCION =
  'Mirá cómo evolucionó el precio de cualquier producto de MercadoLibre antes de comprar. ' +
  'Mínimo, máximo y promedio de los últimos 90 días, y si el descuento que te muestran es real.'

export const metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: `${BASE_URL}/historial-de-precios` },
  openGraph: { title: TITULO, description: DESCRIPCION, url: `${BASE_URL}/historial-de-precios`, type: 'website' }
}

interface CategoriaRow {
  category_name: string
  site_id: string
  items: number
}

function formatN(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

export default async function HistorialDePreciosPage() {
  const [{ count: productos }, { count: registros }, categoriasRes, { count: analisis }] =
    await Promise.all([
      supabaseAdmin.from('items').select('id', { count: 'exact', head: true })
        .eq('is_active', true).is('deleted_at', null),
      supabaseAdmin.from('price_history').select('id', { count: 'exact', head: true }),
      supabaseAdmin.rpc('get_indexable_categories', { p_min_items: 8 }),
      supabaseAdmin.from('reviews_analysis').select('item_id', { count: 'exact', head: true })
    ])

  const todas = (categoriasRes.data as CategoriaRow[] | null) ?? []

  // Una entrada por nombre de categoría: el mismo rubro existe en varios
  // países y la página de categoría es una sola.
  const vistas = new Set<string>()
  const categorias: Array<{ nombre: string; slug: string; items: number }> = []
  for (const c of todas) {
    const slug = slugify(c.category_name)
    if (!slug || vistas.has(slug)) continue
    vistas.add(slug)
    categorias.push({ nombre: c.category_name, slug, items: c.items })
  }
  categorias.sort((a, b) => b.items - a.items)

  const faqs = [
    {
      q: '¿MercadoLibre muestra el historial de precios?',
      a: 'No. La publicación te muestra el precio de hoy y, cuando hay promoción, un precio "antes" que no podés verificar. Lupa Precios guarda el precio de cada producto día a día, así que podés ver vos mismo cuánto costaba hace una semana o hace tres meses.'
    },
    {
      q: '¿Cómo sé si un descuento es real?',
      a: 'Comparando el precio "antes" contra lo que ese producto costó de verdad en los meses anteriores. Si el "antes" aparece sólo unos días antes de la promoción y está muy por encima del precio habitual, el descuento es sobre un precio inflado. En la ficha de cada producto te marcamos cuando detectamos ese patrón.'
    },
    {
      q: '¿Es gratis?',
      a: 'Sí. Ver el historial de cualquier producto es gratis y no hace falta registrarse. Sólo necesitás una cuenta si querés que te avisemos cuando un precio baje.'
    },
    {
      q: '¿Sirve fuera de Argentina?',
      a: 'Sí. Seguimos productos de MercadoLibre en Argentina, México, Brasil, Chile, Colombia, Perú y Uruguay, cada uno con su moneda.'
    },
    {
      q: '¿De dónde salen los precios?',
      a: 'De la API pública de MercadoLibre y de las páginas que visitan quienes usan nuestra extensión. Guardamos un registro cada vez que el precio cambia, con la fecha. No inventamos ni estimamos precios: si no tenemos el dato, la ficha lo dice.'
    }
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="site-header">
        <div className="container site-header-inner">
          <a href="/" className="site-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.png" alt="" width={28} height={28} />
            <span>Lupa Precios</span>
          </a>
          <nav className="site-nav">
            <a href="/ofertas">Ofertas reales</a>
            <a href="/api/auth/login" className="nav-login">Iniciar sesión</a>
          </nav>
        </div>
      </header>

      <main className="hub">
        <div className="container hub-container">
          <nav className="hub-breadcrumb" aria-label="Migas de pan">
            <a href="/">Inicio</a> <span>›</span> <span>Historial de precios</span>
          </nav>

          <h1>Historial de precios de MercadoLibre</h1>
          <p className="hub-lead">
            MercadoLibre te muestra el precio de hoy. Nosotros guardamos el de
            todos los días anteriores, así podés ver si ese 40% de descuento es
            real o si el precio “antes” apareció la semana pasada.
          </p>

          <div className="hub-stats">
            <div className="hub-stat">
              <strong>{formatN(productos ?? 0)}</strong>
              <span>productos seguidos</span>
            </div>
            <div className="hub-stat">
              <strong>{formatN(registros ?? 0)}</strong>
              <span>registros de precio</span>
            </div>
            <div className="hub-stat">
              <strong>{formatN(analisis ?? 0)}</strong>
              <span>opiniones resumidas con IA</span>
            </div>
            <div className="hub-stat">
              <strong>7</strong>
              <span>países de MercadoLibre</span>
            </div>
          </div>

          <section className="hub-section">
            <h2>Ver el historial de un producto</h2>
            <form action="/api/lookup" method="get" className="hub-buscador">
              <label htmlFor="url" className="hub-buscador-label">
                Pegá el link del producto de MercadoLibre
              </label>
              <div className="hub-buscador-row">
                <input
                  id="url"
                  name="url"
                  type="text"
                  placeholder="https://articulo.mercadolibre.com.ar/MLA-..."
                  className="hub-input"
                  required
                />
                <button type="submit" className="hub-submit">Ver historial</button>
              </div>
              <p className="hub-hint">
                Gratis y sin registro. También funciona pegando sólo el código
                del producto (por ejemplo MLA1234567890).
              </p>
            </form>

            <p className="hub-alt">
              Si querés verlo sin salir de MercadoLibre,{' '}
              <a href={installUrl('hub-historial')} target="_blank" rel="noopener noreferrer">
                instalá la extensión de Chrome
              </a>{' '}
              y el gráfico te aparece dentro de la publicación.
            </p>
          </section>

          <section className="hub-section">
            <h2>Cómo saber si un descuento es real</h2>
            <ol className="hub-pasos">
              <li>
                <strong>Mirá el precio “antes”.</strong> Es el número tachado que
                usa la publicación para calcular el porcentaje de descuento.
              </li>
              <li>
                <strong>Comparalo con el historial.</strong> Si ese precio no
                aparece en los últimos meses, o aparece sólo unos días antes de
                la promoción, el descuento está calculado sobre un precio que
                casi nadie pagó.
              </li>
              <li>
                <strong>Fijate en el mínimo real.</strong> Lo que importa no es
                el porcentaje anunciado sino si el precio de hoy está cerca del
                más bajo que tuvo el producto.
              </li>
            </ol>
            <p className="hub-alt">
              En cada ficha marcamos con un aviso los casos donde el precio
              “antes” no coincide con lo que el producto venía costando.{' '}
              <a href="/ofertas">Mirá las ofertas que sí son reales</a>.
            </p>
          </section>

          {categorias.length > 0 && (
            <section className="hub-section">
              <h2>Historial de precios por categoría</h2>
              <ul className="hub-categorias">
                {categorias.map(c => (
                  <li key={c.slug}>
                    <a href={`/categoria/${c.slug}`}>
                      {c.nombre} <span className="hub-cat-n">{formatN(c.items)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="hub-section">
            <h2>Cómo medimos</h2>
            <p className="hub-alt">
              Los precios salen de la API de MercadoLibre y de las páginas que
              visitan quienes usan la extensión. No estimamos ni completamos
              huecos. Si querés el detalle —cada cuánto tomamos los datos, cuándo
              decimos que un descuento está inflado y qué cosas todavía no
              podemos afirmar—{' '}
              <a href="/metodologia">leé nuestra metodología</a>.
            </p>
          </section>

          <section className="hub-section">
            <h2>Preguntas frecuentes</h2>
            <div className="hub-faq">
              {faqs.map(f => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
