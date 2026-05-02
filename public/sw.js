// Lupa Precios — minimal service worker for PWA installability.
// Future: cache static assets for offline use.

const VERSION = 'lupa-v1'

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  // Network-first; fall back to cache only for navigations if offline.
  // Keep this minimal — we don't want to mask backend errors during dev.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><title>Sin conexión</title>' +
        '<div style="font-family:system-ui;padding:48px 24px;text-align:center">' +
        '<h1 style="font-size:22px">Sin conexión</h1>' +
        '<p style="color:#666">Volvé a intentar cuando recuperes internet.</p>' +
        '</div>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
      ))
    )
  }
})
