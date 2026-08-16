const fs = require('fs');
let code = fs.readFileSync('src/components/HabitCard.tsx', 'utf8');

const target = `{habit.isFrozen ? (
          <span className="text-sm font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800/30 flex items-center justify-center whitespace-nowrap" title="Streak paused">🧊</span>
        ) : (
          <span className="text-sm font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1 whitespace-nowrap">🔥 {streak}</span>
        )}`;

const replacement = `{habit.isFrozen ? (
          <span className="text-sm font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800/30 flex items-center justify-center whitespace-nowrap" title="Streak paused">🧊</span>
        ) : streak > 0 ? (
          <span className="text-sm font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1 whitespace-nowrap">🔥 {streak}</span>
        ) : (
          <span className="text-sm font-semibold text-gray-400 bg-gray-100 dark:text-gray-500 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center whitespace-nowrap">0</span>
        )}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/HabitCard.tsx', code);
