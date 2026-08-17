const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

code = code.replace(/self\.addEventListener\('push', e => \{[\s\S]*?\}\);/, `self.addEventListener('push', e => {
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
});`);

fs.writeFileSync('public/sw.js', code);
