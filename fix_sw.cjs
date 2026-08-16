const fs = require('fs');
let code = fs.readFileSync('public/sw.js', 'utf8');

code = code.replace(/habitflow-cache-v0\.5/g, 'habitflow-cache-v0.6');

fs.writeFileSync('public/sw.js', code);
