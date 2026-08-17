const fs = require('fs');
let code = fs.readFileSync('src/components/HabitsPage.tsx', 'utf8');

code = code.replace(/<div className="grid sm:grid-cols-2 gap-3 min-h-\[50px\] pb-4 items-start">/g, '<div className="flex flex-col gap-3 min-h-[50px] pb-4">');

fs.writeFileSync('src/components/HabitsPage.tsx', code);
