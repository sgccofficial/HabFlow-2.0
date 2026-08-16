const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');
code = code.replace(/<div className="pt-2 px-4 pb-8 flex flex-col items-center justify-center min-h-\[70vh\]">/, '<div className="pt-2 px-4 flex flex-col items-center justify-center min-h-[70vh]">');
fs.writeFileSync('src/components/TimerPage.tsx', code);
