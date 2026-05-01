type SearchParams = { reason?: string; detail?: string }

const REASONS: Record<string, string> = {
  no_code: 'No recibimos el código de autorización de MercadoLibre.',
  no_verifier: 'La sesión de autorización expiró. Volvé a iniciar el login.',
  auth_failed: 'MercadoLibre rechazó el código de autorización.',
  user_fetch_failed: 'No pudimos obtener tus datos de MercadoLibre.',
  user_save_failed: 'No pudimos guardar tu cuenta.',
  token_save_failed: 'No pudimos guardar tu sesión.',
  server_error: 'Hubo un error en el servidor. Probá de nuevo en un momento.'
}

export default async function ErrorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { reason, detail } = await searchParams
  const message = (reason && REASONS[reason]) || 'Ocurrió un error inesperado.'

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center', fontFamily: 'var(--font)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Algo salió mal</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>{message}</p>
      {detail && (
        <pre style={{
          background: '#F7F7F7', padding: 12, borderRadius: 6,
          fontSize: 12, color: '#333', textAlign: 'left',
          overflow: 'auto', marginBottom: 24
        }}>{detail}</pre>
      )}
      <a href="/" style={{ color: '#3483FA', fontWeight: 500 }}>← Volver al inicio</a>
    </div>
  )
}
