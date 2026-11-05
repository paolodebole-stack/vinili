/* VINILI â€” Service Worker: PWA offline + Web Push */
const APP_CACHE = 'vinili-app-shell-v2';
const IMAGE_CACHE = 'vinili-images-v1';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    const appUrl = new URL('./', self.registration.scope).href;
    try { await cache.add(new Request(appUrl, { cache: 'reload' })); }
    catch (error) { console.warn('VINILI: pre-cache app shell non riuscita', error); }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vinili-') && ![APP_CACHE, IMAGE_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || network;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(new URL('./', self.registration.scope).href, response.clone()).catch(() => {});
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(new URL('./', self.registration.scope).href)) || Response.error();
      }
    })());
    return;
  }

  if (['script','style','font'].includes(request.destination) || /\.(?:js|css|woff2?|ttf|svg|png|webp|ico)(?:\?|$)/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || network || Response.error();
    })());
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'VINILI';
  const options = {
    body: data.body || 'Hai una nuova comunicazione nel tuo archivio musicale.',
    icon: data.icon || './vinili-192.png',
    badge: data.badge || './vinili-192.png',
    tag: data.tag || `vinili-${Date.now()}`,
    renotify: true,
    data: { url: data.url || self.registration.scope },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL(event.notification?.data?.url || self.registration.scope, self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('navigate' in client) {
        try { await client.navigate(target); await client.focus(); return; } catch {}
      }
    }
    await self.clients.openWindow(target);
  })());
});
