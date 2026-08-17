const fs = require('fs');
let code = fs.readFileSync('src/components/HabitCard.tsx', 'utf8');

code = code.replace(
  /<span className="whitespace-nowrap flex items-center">🧊 Streak paused<\/span>/,
  '<span className="text-[11px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30 flex items-center gap-1 whitespace-nowrap">🧊 Streak paused</span>'
);

code = code.replace(
  /<span className="whitespace-nowrap flex items-center">🔥 \{streak\} \{streak === 1 \? 'day streak' : 'day streak'\}<\/span>/,
  '<span className="text-[11px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1 whitespace-nowrap">🔥 {streak} {streak === 1 ? "day streak" : "day streak"}</span>'
);

fs.writeFileSync('src/components/HabitCard.tsx', code);
