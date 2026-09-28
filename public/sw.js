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
});

self.addEventListener('activate', (e) => {
  // Wipe all legacy and stale caches completely
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Always pass fetch requests through to the network so users always receive latest code
self.addEventListener('fetch', (e) => {
  return;
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
