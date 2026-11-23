// Removes the service worker left by the playable version that once lived at this address.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((all) => all.forEach((each) => each.unregister()));
  if (window.caches) caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
}
