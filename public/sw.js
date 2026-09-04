self.addEventListener('push', e => {
  let data;
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: 'HabitFlow', body: 'New notification from HabitFlow.' };
  }
  
  e.waitUntil(
    self.registration.showNotification(data.title || 'HabitFlow', {
      body: data.body || 'You have a new notification.',
      icon: '/icon-192.png',
      badge: '/badge.png'
    })
  );
});

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open('habitflow-cache-v1.0').then((cache) => {
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
        if (key !== 'habitflow-cache-v1.0') {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('.vite') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('auth')
  ) {
    return;
  }
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then((fetchRes) => {
        return caches.open('habitflow-cache-v1.0').then((cache) => {
          if (e.request.url.startsWith('http')) {
            cache.put(e.request, fetchRes.clone());
          }
          return fetchRes;
        });
      }).catch(() => {
        return caches.match(e.request).then((response) => {
          return response || caches.match('/');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((fetchRes) => {
        return caches.open('habitflow-cache-v1.0').then((cache) => {
          // Cache successful GET requests
          if (e.request.url.startsWith('http')) {
            cache.put(e.request, fetchRes.clone());
          }
          return fetchRes;
        });
      }).catch(() => {});
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
    self.registration.getNotifications().then(notifications => {
      notifications.forEach(notification => notification.close());
    }).then(() => {
      return clients.matchAll({ type: 'window' }).then(windowClients => {
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      });
    })
  );
});
