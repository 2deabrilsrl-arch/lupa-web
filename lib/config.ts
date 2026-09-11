/**
 * Constantes públicas de la app.
 *
 * INSTALL_URL apunta a la ficha real de la extensión en la Chrome Web Store.
 * Antes había un placeholder (`https://chromewebstore.google.com/`) hardcodeado
 * en la home y en la página de producto: todo el tráfico que quería instalar
 * caía en la portada de la tienda y se perdía.
 */
export const EXTENSION_ID = 'ockabfnmlphokbifkphfhfdiifccanij'

export const INSTALL_URL = `https://chromewebstore.google.com/detail/${EXTENSION_ID}?utm_source=lupaweb`

/** Variante con utm_source propio, para medir de qué página vino la instalación. */
export function installUrl(source: string): string {
  return `https://chromewebstore.google.com/detail/${EXTENSION_ID}?utm_source=${encodeURIComponent(source)}`
}
