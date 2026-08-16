const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<div className="pt-4">/, '<div className="pt-4 pb-28">');

fs.writeFileSync('src/App.tsx', code);
