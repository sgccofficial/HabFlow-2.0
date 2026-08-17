const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

const regex = /self\.addEventListener\('fetch', \(e\) => \{[\s\S]*?self\.addEventListener\('sync'/;

const replace = `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  // Only cache same-origin requests (static assets)
  if (url.origin !== self.location.origin) {
    return;
  }
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then((fetchRes) => {
        return caches.open('habitflow-cache-v0.9').then((cache) => {
          cache.put(e.request, fetchRes.clone());
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
        return caches.open('habitflow-cache-v0.9').then((cache) => {
          cache.put(e.request, fetchRes.clone());
          return fetchRes;
        });
      }).catch(() => {});
    })
  );
});

self.addEventListener('sync'`;

code = code.replace(regex, replace);
code = code.replace(/habitflow-cache-v0\.8/g, 'habitflow-cache-v0.9');

fs.writeFileSync('public/sw.js', code);
