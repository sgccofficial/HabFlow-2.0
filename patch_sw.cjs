const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

code = code.replace(/self\.addEventListener\('notificationclick', event => \{[\s\S]*?clients\.openWindow\('\/'\);\s*\}\s*\}\)\s*\);\s*\}\);/, `self.addEventListener('notificationclick', event => {
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
});`);

fs.writeFileSync('public/sw.js', code);
