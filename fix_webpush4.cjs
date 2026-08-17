const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/if \(e\.statusCode === 410 \|\| e\.statusCode === 404\) \{/, "if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403 || (e.body && e.body.includes('Received unexpected response code'))) {");

fs.writeFileSync('server.ts', code);
