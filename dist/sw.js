// Murugan service worker: only so phones can install the app.
// It NEVER keeps old copies: every page and file comes fresh from the server, so updates show at once.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k)      // remove anything an old version saved
  await self.clients.claim()
})()))
self.addEventListener('fetch', e => {
  const r = e.request
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return
  // the page itself: always ask the server (no browser cache), so a new deploy is picked up on the next open
  if (r.mode === 'navigate') e.respondWith(fetch(r, { cache: 'no-store' }).catch(() => fetch(r)))
})
