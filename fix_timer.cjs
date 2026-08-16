const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');
code = code.replace(/max-w-\[380px\]/g, 'max-w-3xl mx-auto');
fs.writeFileSync('src/components/TimerPage.tsx', code);
