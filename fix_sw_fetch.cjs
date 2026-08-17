const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

const target = `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
    
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {`;

const replace = `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('google.com')) {
    return;
  }
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {`;

code = code.replace(target, replace);
code = code.replace(/habitflow-cache-v0\.6/g, 'habitflow-cache-v0.7');
fs.writeFileSync('public/sw.js', code);
