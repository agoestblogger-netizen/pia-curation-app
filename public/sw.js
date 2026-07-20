const CACHE_NAME = 'pia-curation-cache-v2-bypass';

self.addEventListener('install', (event) => {
  // Memaksa SW baru untuk segera mengambil alih tanpa menunggu browser direstart
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // SATUKAN semua Promise dalam satu event.waitUntil agar browser tidak bingung/hang
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Langsung kendalikan semua client/tab yang terbuka
      caches.keys().then((cacheNames) => {
        // Hapus semua cache lama
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Biarkan kosong / return segera.
  // Dengan TIDAK memanggil event.respondWith(), browser akan menangani request
  // secara native (seolah-olah tidak ada Service Worker). Ini jauh lebih cepat 
  // dan menghindari overhead/hang dari SW proxying.
  // Listener ini tetap ada HANYA untuk memenuhi syarat PWA (Installable).
  return;
});
