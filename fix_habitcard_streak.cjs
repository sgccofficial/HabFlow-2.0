const fs = require('fs');
let code = fs.readFileSync('src/components/HabitCard.tsx', 'utf8');

// 1. Remove from under title
const underTitleStreak = `{habit.isFrozen ? (
            <span className="text-[11px] font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800/30 flex items-center gap-1 whitespace-nowrap">🧊 {streak}</span>
          ) : (
            <span className="text-[11px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1 whitespace-nowrap">🔥 {streak}</span>
          )}`;
code = code.replace(underTitleStreak, '');

// 2. Add to right side
const rightSide = `<div className="flex items-center gap-2 flex-shrink-0">`;
const rightSideReplacement = `<div className="flex items-center gap-2 flex-shrink-0">
        {habit.isFrozen ? (
          <span className="text-sm font-semibold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 rounded-full border border-blue-100 dark:border-blue-800/30 flex items-center justify-center whitespace-nowrap" title="Streak paused">🧊</span>
        ) : (
          <span className="text-sm font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1 whitespace-nowrap">🔥 {streak}</span>
        )}`;
code = code.replace(rightSide, rightSideReplacement);

fs.writeFileSync('src/components/HabitCard.tsx', code);
