const CACHE_NAME = 'pia-curation-cache-v2-bypass';

self.addEventListener('install', (event) => {
  // Memaksa SW baru untuk segera mengambil alih tanpa menunggu browser direstart
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Langsung kendalikan semua client/tab yang terbuka
  event.waitUntil(self.clients.claim());
  
  // HAPUS semua cache lama yang tersisa dari versi sebelumnya
  // Ini penting agar user lama terbebas dari jebakan cache file yang sudah usang
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // OPSI A: Bypass Cache sepenuhnya
  // Semua request akan langsung mengarah ke network tanpa melalui cache browser.
  // Strategi ini adalah yang paling aman untuk mencegah "ChunkLoadError" dan 
  // memastikan user selalu mendapat versi terbaru setiap ada deployment.
  event.respondWith(fetch(event.request));
});
