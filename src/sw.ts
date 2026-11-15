/// <reference lib="webworker" />
import { cacheNames, clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

// A new version takes over straight away but never reloads the page, so a run in progress is left alone.
void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Safari asks for music a slice at a time, and will not play a whole file sent in answer.
registerRoute(
  ({ request, url }) => request.headers.has('range') && url.pathname.includes('/assets/audio/'),
  new CacheFirst({ cacheName: cacheNames.precache, matchOptions: { ignoreSearch: true }, plugins: [new RangeRequestsPlugin()] }),
);

// The whole game: code, pictures and music, stored on first visit so it opens and plays with no connection.
precacheAndRoute(self.__WB_MANIFEST);
