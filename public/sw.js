// Service Worker mínimo: cachea los assets de la app al instalar.
const CACHE = 'rotulo-vega-v1'

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo-vega.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  // Solo GET
  if (e.request.method !== 'GET') return

  // Nunca cachear peticiones al propio dominio fuera de scope
  if (!e.request.url.startsWith(self.location.origin)) return

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // Devuelve caché y en paralelo actualiza (stale-while-revalidate)
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})