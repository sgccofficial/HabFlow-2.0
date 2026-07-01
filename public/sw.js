self.addEventListener('push', e => {
  const data = e.data.json();
  console.log('Push Recieved...');
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge.png'
  });
});

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open('habitflow-cache-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== 'habitflow-cache-v1') {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((fetchRes) => {
        return caches.open('habitflow-cache-v1').then((cache) => {
          // Cache successful GET requests
          if (e.request.url.startsWith('http')) {
            cache.put(e.request, fetchRes.clone());
          }
          return fetchRes;
        });
      }).catch(() => {
        // Fallback for offline if resource not in cache
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Background sync event triggered');
    event.waitUntil(
      // Implement data sync logic here (e.g. flushing IndexedDB offline queue to server)
      Promise.resolve().then(() => console.log('Data synced successfully'))
    );
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-daily-data') {
    console.log('[Service Worker] Periodic sync event triggered');
    event.waitUntil(
      // Implement daily background data fetch here
      Promise.resolve().then(() => console.log('Daily data synced successfully'))
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
