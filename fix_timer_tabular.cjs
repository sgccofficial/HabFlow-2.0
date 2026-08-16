const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');

code = code.replace(/text-5xl md:text-7xl lg:text-8xl font-mono tracking-tighter/g, 'text-5xl md:text-7xl lg:text-8xl font-mono tabular-nums tracking-tighter');

fs.writeFileSync('src/components/TimerPage.tsx', code);
