const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');

code = code.replace(/className="relative w-72 h-72 mb-6 flex items-center justify-center"/g, 'className="relative w-72 h-72 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] mb-6 flex items-center justify-center"');

code = code.replace(/text-5xl font-bold text-gray-900 dark:text-white mb-2 tabular-nums/g, 'text-5xl md:text-7xl lg:text-8xl font-bold text-gray-900 dark:text-white mb-2 tabular-nums');

code = code.replace(/text-sm text-gray-500 font-medium/g, 'text-sm md:text-base lg:text-lg text-gray-500 font-medium');

fs.writeFileSync('src/components/TimerPage.tsx', code);
