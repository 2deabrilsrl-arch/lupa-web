/**
 * Contenido del mail de pedido de reseña. Separado del envío para poder
 * previsualizarlo sin conexión ni claves:
 *
 *   node scripts/preview-review-email.mjs > preview.html
 */
export const REVIEW_URL =
  'https://chromewebstore.google.com/detail/ockabfnmlphokbifkphfhfdiifccanij/reviews'

export const FIXES = [
  'El precio actual ahora es el actual, y el gráfico va en el orden correcto.',
  'Los productos de México, Perú, Chile, Colombia y Uruguay se mostraban en pesos argentinos. Ya no.',
  'El seguimiento de precios estaba frenado desde agosto. Volvió a andar.',
  'El botón para instalar la extensión no llevaba a ningún lado. Sí, así de tonto.'
]

export const SUBJECT = 'Te estábamos mostrando un precio viejo (ya está arreglado)'

export function html() {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="padding:20px 24px;background:linear-gradient(180deg,#F0F7FF 0%,#fff 100%);border-bottom:1px solid #efefef;">
        <div style="font-size:13px;color:#3483FA;font-weight:600;">🔍 Lupa Precios</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">¡Hola!</p>

        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          Te escribo porque encontré un error feo en Lupa Precios y prefiero contártelo yo
          antes de que lo notes vos.
        </p>

        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          Durante un tiempo, la ficha de cada producto mostraba como "precio actual" el precio
          <strong>más viejo</strong> que teníamos guardado — en algunos casos de hasta 90 días
          atrás. Si entraste a fijarte si convenía comprar algo, te pude haber dado un número
          equivocado.
        </p>

        <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
          Ya está arreglado, junto con varias cosas más:
        </p>

        <ul style="font-size:14.5px;line-height:1.65;color:#444;padding-left:20px;margin:0 0 20px;">
          ${FIXES.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join('\n          ')}
        </ul>

        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
          Si la herramienta te sirve, te pido un favor concreto:
          <strong>dejá una reseña en la Chrome Web Store</strong>. Somos 112 usuarios y cero
          reseñas, y sin reseñas la extensión no le aparece a nadie que la busque. Son dos
          minutos y hoy es lo que más nos ayuda.
        </p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${REVIEW_URL}" style="display:inline-block;padding:12px 28px;background:#3483FA;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">⭐ Dejar una reseña</a>
        </div>

        <p style="font-size:15px;line-height:1.6;margin:0;">
          Y si algo no te cierra, te falta o te confunde, respondeme este mail. Lo leo yo.
        </p>

        <p style="font-size:15px;line-height:1.6;margin:20px 0 0;">
          Gracias,<br/>Lupa Precios
        </p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #f7f7f7;font-size:11px;color:#999;text-align:center;">
        Recibís este mail porque te registraste en Lupa Precios. Si no querés recibir más,
        respondé "baja" y te sacamos.<br/>
        <a href="https://lupaprecios.com" style="color:#3483FA;text-decoration:none;">lupaprecios.com</a> ·
        <a href="https://lupaprecios.com/privacidad" style="color:#3483FA;text-decoration:none;">Privacidad</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function text() {
  return [
    '¡Hola!',
    '',
    'Te escribo porque encontré un error feo en Lupa Precios y prefiero contártelo yo antes de que lo notes vos.',
    '',
    'Durante un tiempo, la ficha de cada producto mostraba como "precio actual" el precio MÁS VIEJO que teníamos guardado — en algunos casos de hasta 90 días atrás. Si entraste a fijarte si convenía comprar algo, te pude haber dado un número equivocado.',
    '',
    'Ya está arreglado, junto con varias cosas más:',
    ...FIXES.map(f => `- ${f}`),
    '',
    'Si la herramienta te sirve, te pido un favor concreto: dejá una reseña en la Chrome Web Store. Somos 112 usuarios y cero reseñas, y sin reseñas la extensión no le aparece a nadie que la busque. Son dos minutos y hoy es lo que más nos ayuda.',
    '',
    REVIEW_URL,
    '',
    'Y si algo no te cierra, te falta o te confunde, respondeme este mail. Lo leo yo.',
    '',
    'Gracias,',
    'Lupa Precios',
    '',
    '---',
    'Recibís este mail porque te registraste en Lupa Precios. Si no querés recibir más, respondé "baja" y te sacamos.'
  ].join('\n')
}

