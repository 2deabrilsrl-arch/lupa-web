import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Lupa Precios',
  description: 'Términos y condiciones de uso de Lupa Precios.',
  alternates: { canonical: 'https://lupaprecios.com/terminos' }
}

const LAST_UPDATED = '1 de mayo de 2026'

export default function TermsPage() {
  return (
    <main className="legal">
      <div className="container legal-container">
        <h1>Términos y Condiciones</h1>
        <p className="legal-meta">Última actualización: {LAST_UPDATED}</p>

        <p>
          Estos términos rigen el uso del sitio lupaprecios.com y de la extensión de Chrome
          Lupa Precios (en conjunto, el &quot;Servicio&quot;). Al usar el Servicio aceptás
          estos términos.
        </p>

        <h2>1. Descripción del servicio</h2>
        <p>
          Lupa Precios es una herramienta gratuita que muestra el historial de precios de
          productos publicados en MercadoLibre, detecta descuentos potencialmente engañosos y
          ofrece alertas configurables.
        </p>

        <h2>2. Cuentas</h2>
        <p>
          Para usar las funciones avanzadas (alertas, historial extendido) podés iniciar
          sesión con tu cuenta de MercadoLibre. Sos responsable de mantener la seguridad de
          tu cuenta.
        </p>

        <h2>3. Uso aceptable</h2>
        <p>No podés usar el Servicio para:</p>
        <ul>
          <li>Realizar scraping masivo o automatizado más allá de tu uso personal.</li>
          <li>Revender, redistribuir o crear productos derivados sin autorización escrita.</li>
          <li>Vulnerar la seguridad del Servicio o de los servicios de MercadoLibre.</li>
          <li>Infringir leyes argentinas o de tu jurisdicción.</li>
        </ul>

        <h2>4. Propiedad intelectual</h2>
        <p>
          El código, diseño, logo y marca &quot;Lupa Precios&quot; son propiedad de los
          dueños del Servicio. No podés usarlos sin permiso.
        </p>
        <p>
          Los datos de productos provienen de MercadoLibre y son propiedad de sus respectivos
          dueños.
        </p>

        <h2>5. Relación con MercadoLibre</h2>
        <p>
          <strong>
            Lupa Precios es una herramienta independiente y no está afiliada, respaldada ni
            patrocinada por MercadoLibre S.R.L.
          </strong>{' '}
          MercadoLibre es una marca registrada de MercadoLibre S.R.L. El uso del nombre y de
          datos públicos de MercadoLibre se limita a fines descriptivos e informativos.
        </p>

        <h2>6. Disponibilidad y cambios</h2>
        <p>
          El Servicio se ofrece &quot;tal cual&quot;. Podemos modificar, suspender o
          interrumpir cualquier parte del Servicio en cualquier momento. Vamos a hacer
          esfuerzos razonables para avisar con anticipación cuando sea posible.
        </p>

        <h2>7. Limitación de responsabilidad</h2>
        <p>
          La información de precios y descuentos es referencial y puede contener errores o
          retrasos. <strong>No tomes decisiones de compra basándote únicamente en Lupa
          Precios.</strong> Hasta el máximo permitido por la ley aplicable, no nos hacemos
          responsables por daños indirectos, lucro cesante, ni pérdidas derivadas del uso del
          Servicio.
        </p>

        <h2>8. Cancelación</h2>
        <p>
          Podés dejar de usar el Servicio en cualquier momento desinstalando la extensión o
          eliminando tu cuenta desde tu panel. Podemos cancelar o suspender tu cuenta si
          incumplís estos términos.
        </p>

        <h2>9. Cambios a estos términos</h2>
        <p>
          Podemos actualizar estos términos periódicamente. La fecha al inicio indica la
          última modificación. El uso continuado del Servicio luego de la actualización
          implica tu aceptación.
        </p>

        <h2>10. Ley aplicable y jurisdicción</h2>
        <p>
          Estos términos se rigen por las leyes de la República Argentina. Cualquier
          controversia será resuelta por los tribunales ordinarios de la Ciudad Autónoma de
          Buenos Aires, salvo que la ley imponga otra jurisdicción.
        </p>

        <h2>11. Contacto</h2>
        <p>
          Lupa Precios — <a href="mailto:hola@lupaprecios.com">hola@lupaprecios.com</a>
        </p>

        <p style={{ marginTop: 32 }}>
          <a href="/">← Volver al inicio</a>
        </p>
      </div>
    </main>
  )
}
