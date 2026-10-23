/* VINILI — Service Worker per Web Push */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
