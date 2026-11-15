/* LIQRADAR service worker — network-first for HTML, cache-first for hashed assets.
   Hard rule (iOS Safari): respondWith must never resolve to null/undefined —
   every path returns a real Response or the handler is not called at all.
   Alle Pfade sind relativ zum SW-Scope, damit die App auch in einem
   Unterverzeichnis (z. B. https://host/app/) zuverlässig funktioniert. */
const CACHE = 'liqradar-v24'
const ROOT = new URL('./', self.registration.scope).pathname

const OFFLINE_HTML =
  '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>LIQRADAR — Offline</title></head>' +
  '<body style="margin:0;background:#050810;color:#ebebeb;font-family:system-ui,sans-serif;' +
  'display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px">' +
  '<p>Verbindung unterbrochen.<br>Bitte prüfe dein Netz und lade die Seite neu.</p>' +
  '</body></html>'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return

  // HTML / navigations: network first, then cache, then a guaranteed offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request)
          if (res && res.ok) {
            const cache = await caches.open(CACHE)
            cache.put(ROOT, res.clone()).catch(() => {})
          }
          return res
        } catch {
          const cached = (await caches.match(request)) || (await caches.match(ROOT))
          if (cached) return cached
          return new Response(OFFLINE_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        }
      })(),
    )
    return
  }

  // hashed build assets, icons and font files: cache first (immutable)
  if (
    url.pathname.startsWith(ROOT + 'assets/') ||
    url.pathname.startsWith(ROOT + 'icons/') ||
    url.pathname.startsWith(ROOT + 'fonts/')
  ) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res && (res.ok || res.type === 'opaque')) {
          const cache = await caches.open(CACHE)
          cache.put(request, res.clone()).catch(() => {})
        }
        return res
      })(),
    )
  }
})

// Tippen auf eine Mitteilung: App in den Vordergrund holen bzw. öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow(ROOT)
    })(),
  )
})
