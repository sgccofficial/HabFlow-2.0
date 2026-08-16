const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const \{ deleteDoc \} = require\('firebase\/firestore'\);\n\s*await deleteDoc\(d\.ref\);/, "await deleteDoc(d.ref);");

fs.writeFileSync('server.ts', code);
