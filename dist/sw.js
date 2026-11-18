// Murugan service worker: lets phones install the app.
// v2.1.0 - force refresh old caches
const VERSION = 'murugan-2026-11-18-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  // Fetch fresh from network, fallback to cache if offline
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
