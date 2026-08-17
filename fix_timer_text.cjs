const fs = require('fs');
let code = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');

code = code.replace(/className="w-56 bg-transparent text-center border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:outline-none text-5xl font-mono tracking-tighter text-gray-900 dark:text-white"/g, 'className="w-full bg-transparent text-center border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:outline-none text-5xl md:text-7xl lg:text-8xl font-mono tracking-tighter text-gray-900 dark:text-white"');

code = code.replace(/<span className="text-5xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2">/g, '<span className="text-5xl md:text-7xl lg:text-8xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2">');

code = code.replace(/<span className="text-4xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2 ml-2">/g, '<span className="text-5xl md:text-7xl lg:text-8xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2 ml-2">');

fs.writeFileSync('src/components/TimerPage.tsx', code);
