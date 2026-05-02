import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Lupa Precios',
  description: 'Cómo Lupa Precios recolecta, usa y protege tu información.',
  alternates: { canonical: 'https://lupaprecios.com/privacidad' }
}

const LAST_UPDATED = '1 de mayo de 2026'

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="container legal-container">
        <h1>Política de Privacidad</h1>
        <p className="legal-meta">Última actualización: {LAST_UPDATED}</p>

        <p>
          En Lupa Precios respetamos tu privacidad. Esta política explica qué información
          recolectamos cuando usás nuestra extensión de Chrome y nuestro sitio web
          (lupaprecios.com), cómo la usamos y qué derechos tenés sobre ella.
        </p>

        <h2>1. Información que recolectamos</h2>
        <h3>1.1. Información que vos nos das</h3>
        <ul>
          <li>
            <strong>Cuenta de MercadoLibre:</strong> si elegís iniciar sesión con tu cuenta de
            MercadoLibre, recibimos tu identificador, nickname y email a través del flujo de
            autenticación oficial de MercadoLibre (OAuth 2.0 con PKCE).
          </li>
          <li>
            <strong>Configuración de alertas:</strong> los productos y precios objetivo que
            configurás dentro de la app.
          </li>
        </ul>

        <h3>1.2. Información que recolectamos automáticamente</h3>
        <ul>
          <li>
            <strong>Productos visitados en MercadoLibre:</strong> mientras tenés la extensión
            instalada, registramos los identificadores públicos de los productos que visitás
            para construir el historial de precios. No registramos tus búsquedas, ni datos de
            tarjetas, ni información de tu cuenta de comprador.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y eventos de uso
            básicos para detectar errores y abusos.
          </li>
        </ul>

        <h2>2. Cómo usamos tu información</h2>
        <ul>
          <li>Para construir y mantener el historial público de precios de productos.</li>
          <li>Para enviarte alertas cuando un precio que estás siguiendo cambia.</li>
          <li>Para detectar y prevenir fraudes y abuso del servicio.</li>
          <li>Para mejorar la herramienta.</li>
        </ul>
        <p>
          <strong>No vendemos ni alquilamos tus datos personales a terceros.</strong>
        </p>

        <h2>3. Terceros que procesan tus datos</h2>
        <ul>
          <li>
            <strong>Supabase</strong> (base de datos y autenticación): aloja tu información de
            cuenta y los historiales de precios.
          </li>
          <li>
            <strong>Vercel</strong> (hosting): aloja el sitio y las funciones del backend.
          </li>
          <li>
            <strong>MercadoLibre</strong>: para autenticación y consulta de información pública
            de productos.
          </li>
          <li>
            <strong>Google Chrome Web Store</strong>: distribuye la extensión.
          </li>
        </ul>

        <h2>4. Cookies</h2>
        <p>
          Usamos cookies esenciales para mantener tu sesión iniciada (cookie firmada con HMAC
          y marcada como HttpOnly). No usamos cookies de tracking publicitario.
        </p>

        <h2>5. Tus derechos</h2>
        <p>
          De acuerdo con la Ley 25.326 de Protección de Datos Personales (Argentina) tenés
          derecho a:
        </p>
        <ul>
          <li>Acceder a los datos personales que tenemos sobre vos.</li>
          <li>Pedir que los corrijamos si están incompletos o son incorrectos.</li>
          <li>Pedir que los eliminemos.</li>
          <li>Oponerte al tratamiento.</li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos escribinos a{' '}
          <a href="mailto:hola@lupaprecios.com">hola@lupaprecios.com</a>.
        </p>

        <h2>6. Retención</h2>
        <p>
          Mantenemos tu información de cuenta mientras tu cuenta esté activa. Si la eliminás,
          marcamos tus datos como borrados y los purgamos definitivamente a los 30 días.
        </p>

        <h2>7. Menores de edad</h2>
        <p>
          El servicio no está dirigido a menores de 13 años. No recolectamos a sabiendas datos
          de menores. Si descubrís que un menor nos envió datos, escribinos para eliminarlos.
        </p>

        <h2>8. Cambios a esta política</h2>
        <p>
          Si actualizamos esta política, vamos a publicar la nueva versión en esta página y
          actualizar la fecha. Si los cambios son significativos, te avisaremos por email o
          mediante un banner en el sitio.
        </p>

        <h2>9. Contacto</h2>
        <p>
          Lupa Precios — <a href="mailto:hola@lupaprecios.com">hola@lupaprecios.com</a>
        </p>

        <p className="legal-disclaimer">
          Lupa Precios es una herramienta independiente y no está afiliada, respaldada ni
          patrocinada por MercadoLibre S.R.L.
        </p>

        <p style={{ marginTop: 32 }}>
          <a href="/">← Volver al inicio</a>
        </p>
      </div>
    </main>
  )
}
