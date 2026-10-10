// Service Worker de Rótulo VEGA.
//
// ⚠️ CADA VEZ QUE PUBLIQUES UNA VERSIÓN NUEVA, SUBE ESTE NÚMERO.
// (aunque con network-first para el HTML ya no es imprescindible,
// sirve para forzar la limpieza del caché viejo en todos los equipos)
const VERSION = 'v7'
const CACHE = `vega-rotulos-${VERSION}`

// Solo recursos estáticos que casi no cambian. NO se precachean '/'
// ni '/index.html': eso era lo que dejaba a otros usuarios viendo
// una versión vieja de la app.
const PRECACHE = [
  '/manifest.webmanifest',
  '/logo-vega.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/fonts/ArchivoBlack-Regular.ttf',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // 1) HTML (navegación) y sw.js: SIEMPRE red primero. Solo si no hay
  //    internet se usa la copia guardada (modo offline).
  const isHtml = req.mode === 'navigate' || req.destination === 'document'
  if (isHtml) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/')))
    )
    return
  }

  // 2) JS/CSS generados por Vite (/assets/xxxx-HASH.js): el nombre
  //    cambia en cada build, así que cache-first es seguro.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone()
              caches.open(CACHE).then((c) => c.put(req, clone))
            }
            return res
          })
      )
    )
    return
  }

  // 3) Solo los recursos estáticos conocidos (logo, iconos, fuente):
  //    caché con actualización en segundo plano. Cualquier otra cosa
  //    (p. ej. los /src/*.jsx de "npm run dev") va directo a la red,
  //    para no ver código viejo mientras desarrollas.
  if (!PRECACHE.includes(url.pathname)) return

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})