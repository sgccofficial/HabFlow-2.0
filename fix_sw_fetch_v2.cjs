const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

const target = `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {`;

code = code.replace(/self\.addEventListener\('fetch', \(e\) => \{\n  if \(e\.request\.method !== 'GET'\) return;\n\n  if \(e\.request\.mode === 'navigate' \|\| e\.request\.headers\.get\('accept'\)\.includes\('text\/html'\)\) \{/g, `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('google.com')) {
    return;
  }
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {`);

// Just to be absolutely safe, let's use a robust string replacement
const regex = /self\.addEventListener\('fetch', \(e\) => \{\s+if \(e\.request\.method !== 'GET'\) return;\s+if \(e\.request\.mode === 'navigate' \|\| e\.request\.headers\.get\('accept'\)\.includes\('text\/html'\)\) \{/g;
const replace2 = `self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') || url.hostname.includes('google.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('auth')) {
    return;
  }
  
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {`;
code = code.replace(regex, replace2);
code = code.replace(/habitflow-cache-v0\.7/g, 'habitflow-cache-v0.8');

fs.writeFileSync('public/sw.js', code);
