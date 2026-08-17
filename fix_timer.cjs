const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');

const target = `<div className="pt-4 px-4 pb-4 flex flex-col items-center justify-center min-h-[calc(100dvh-6rem)] overflow-hidden">`;
const replace = `<div className="pt-2 px-4 pb-8 flex flex-col items-center justify-center min-h-[70vh]">`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/TimerPage.tsx', code);
