const fs = require('fs');
let code = fs.readFileSync('src/components/BottomNav.tsx', 'utf8');

const target = `<nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 pb-[env(safe-area-inset-bottom)] z-50">`;

const replace = `<nav 
      className="fixed left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[400px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-2xl rounded-2xl z-50"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/BottomNav.tsx', code);
