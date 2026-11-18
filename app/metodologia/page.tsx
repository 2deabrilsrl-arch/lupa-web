import { supabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/seo'

/**
 * Cómo medimos.
 *
 * El competidor directo tiene una /metodologia y es parte de por qué los
 * medios lo citan: un periodista no levanta un número sin saber de dónde sale.
 * Es la página más barata de hacer y la que más credibilidad compra.
 *
 * Regla para mantenerla: acá no se escribe nada que el código no haga. Si
 * cambia un umbral, cambia esta página en el mismo commit.
 */

export const revalidate = 3600

const TITULO = 'Cómo medimos los precios — Metodología | Lupa Precios'
const DESCRIPCION =
  'De dónde salen los precios que publicamos, cada cuánto los tomamos, cómo ' +
  'decidimos que un descuento está inflado y qué cosas todavía no podemos afirmar.'

export const metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: `${BASE_URL}/metodologia` },
  openGraph: { title: TITULO, description: DESCRIPCION, url: `${BASE_URL}/metodologia`, type: 'article' }
}

function formatN(n: number) {
  return new Intl.NumberFormat('es-AR').format(n)
}

export default async function MetodologiaPage() {
  const [{ count: productos }, { count: registros }, { data: primero }] = await Promise.all([
    supabaseAdmin.from('items').select('id', { count: 'exact', head: true })
      .eq('is_active', true).is('deleted_at', null),
    supabaseAdmin.from('price_history').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('price_history').select('captured_at')
      .order('captured_at', { ascending: true }).limit(1).maybeSingle<{ captured_at: string }>()
  ])

  const desde = primero?.captured_at
    ? new Date(primero.captured_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    : null

  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

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
            <a href="/ofertas" className="nav-link-secondary">Ofertas</a>
          </nav>
        </div>
      </header>

      <main className="hub">
        <div className="container hub-container">
          <nav className="hub-breadcrumb" aria-label="Migas de pan">
            <a href="/">Inicio</a> <span>›</span> <span>Metodología</span>
          </nav>

          <h1>Cómo medimos</h1>
          <p className="hub-lead">
            Esta página explica de dónde salen los números que publicamos y,
            sobre todo, qué cosas todavía no podemos afirmar. Si vas a citarnos,
            leé primero las limitaciones.
          </p>
          <p className="meto-fecha">Actualizada el {hoy}</p>

          <section className="hub-section">
            <h2>De dónde salen los precios</h2>
            <p>
              De dos fuentes, las dos reales: la API pública de MercadoLibre y
              las páginas de producto que visitan quienes usan nuestra extensión
              de Chrome. No estimamos, no interpolamos y no completamos huecos.
              Si de un producto no tenemos dato en una fecha, la ficha no
              muestra nada para esa fecha.
            </p>
            <p>
              Guardamos el precio de venta y, cuando la publicación lo muestra,
              el precio “anterior” tachado que usa para calcular el porcentaje
              de descuento. Un registro nuevo se guarda sólo si el precio cambió
              respecto del anterior, así que la cantidad de registros de un
              producto es la cantidad de veces que se movió, no la cantidad de
              veces que lo miramos.
            </p>
          </section>

          <section className="hub-section">
            <h2>Cada cuánto los tomamos</h2>
            <p>
              Un proceso automático recorre el catálogo cada seis horas y toma
              el precio de los productos más desactualizados primero. A hoy
              seguimos {formatN(productos ?? 0)} productos y tenemos{' '}
              {formatN(registros ?? 0)} registros de precio
              {desde ? `, desde ${desde}` : ''}.
            </p>
            <p>
              Los productos que la API de MercadoLibre no resuelve se reintentan
              varias veces antes de darlos de baja, y vuelven a entrar solos si
              alguien los visita con la extensión.
            </p>
          </section>

          <section className="hub-section">
            <h2>Cuándo decimos que un descuento está inflado</h2>
            <p>
              Cuando el precio “anterior” que muestra la publicación no
              coincide con lo que el producto venía costando de verdad.
              En concreto: miramos el precio más bajo registrado en los
              <strong> últimos 30 días</strong> y, si ese precio es menor al
              “anterior” anunciado por más de un 5%, mostramos el aviso.
            </p>
            <p>
              Dicho en criollo: si el producto ya se vendió a $100 en el último
              mes y la promoción dice “antes $150, ahora $120”, ese $150 no es
              un precio que la gente haya pagado.
            </p>
            <p className="meto-nota">
              Necesitamos al menos dos registros de precio en esos 30 días para
              opinar. Con uno solo no hay con qué comparar, y preferimos no
              decir nada antes que acusar mal a un vendedor.
            </p>
          </section>

          <section className="hub-section">
            <h2>Qué todavía no podemos afirmar</h2>
            <ul className="meto-limites">
              <li>
                <strong>No medimos “MercadoLibre” sino nuestro catálogo.</strong>{' '}
                Seguimos los productos que alguien buscó o visitó alguna vez con
                la extensión. No es una muestra representativa del sitio, así
                que no sacamos porcentajes sobre el total de MercadoLibre.
              </li>
              <li>
                <strong>Nuestro historial es corto.</strong> Empezamos a
                registrar precios hace pocos meses y durante buena parte de ese
                tiempo el proceso automático anduvo mal. Para la mayoría de los
                productos todavía no tenemos la densidad de datos que hace falta
                para un veredicto firme.
              </li>
              <li>
                <strong>Un aviso de descuento inflado no es una acusación de
                fraude.</strong> Dice que el precio “anterior” no coincide con
                nuestro historial. Puede haber explicaciones legítimas: cambio
                de vendedor, cambio de presentación del producto o una suba real
                de precio entre medio.
              </li>
              <li>
                <strong>En un país con inflación, un precio viejo no es
                comparable sin más.</strong> Por eso la ventana es de 30 días y
                no de un año.
              </li>
            </ul>
          </section>

          <section className="hub-section">
            <h2>Errores</h2>
            <p>
              Si ves un precio que no cuadra o un aviso que te parece
              equivocado, escribinos y lo revisamos. Corregimos el dato y, si el
              error fue de criterio, corregimos esta página.
            </p>
          </section>
        </div>
      </main>
    </>
  )
}
