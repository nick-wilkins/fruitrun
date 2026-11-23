// This address once served the game itself, with a service worker that kept a copy. This one replaces it, throws
// the copy away and removes itself, so that a returning visitor sees the website.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  ),
);
