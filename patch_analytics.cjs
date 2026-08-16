const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// Update imports
code = code.replace("calculateStreak, calculateLongestStreak, cn, isHabitDayFrozen, formatDate }", "calculateStreak, calculateLongestStreak, cn, isHabitDayFrozen, formatDate, getHabitTargetValue, getHabitProgressValue, checkDayStatus }");

// specific habit logic replacement
code = code.replace(/const isDone = specificHabit\.dates\.includes\(dStr\);/, "const status = checkDayStatus(specificHabit, dStr);\n              const isDone = status === 'completed';\n              const isPartial = status === 'partial';");

// coloring logic in specific habit
code = code.replace(/\} else if \(isDone\) \{\n\s*colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';\n\s*tooltip \+= ' - Completed';/, `} else if (isDone) {
                colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';
                tooltip += ' - Completed';
              } else if (isPartial) {
                const pVal = getHabitProgressValue(specificHabit, dStr);
                const tVal = getHabitTargetValue(specificHabit);
                colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                tooltip += \` - Partial (\${pVal}/\${tVal})\`;`);

// overview logic replacement (activeCount, completedCount, etc.)
code = code.replace(/const isDone = h\.dates\.includes\(dStr\);\n\s*if \(isTDay \|\| isDone\) \{\n\s*activeCount\+\+;\n\s*if \(isDone\) completedCount\+\+;\n\s*\}/g, `const status = checkDayStatus(h, dStr);
                      const isDone = status === 'completed';
                      const isPartial = status === 'partial';
                      if (isTDay || isDone || isPartial) {
                        activeCount++;
                        if (isDone) completedCount++;
                        else if (isPartial) partialCount++;
                      }`);
                      
// Add partialCount definition
code = code.replace(/let activeCount = 0;\n\s*let frozenCount = 0;/g, `let activeCount = 0;\n                let frozenCount = 0;\n                let partialCount = 0;`);

// Overview coloring logic
code = code.replace(/const ratio = completedCount \/ activeCount;\n\s*if \(completedCount === 0\) \{\n\s*colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';\n\s*tooltip \+= ' - None done';/g, `const ratio = completedCount / activeCount;
                  if (completedCount === 0 && partialCount === 0) {
                    colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                    tooltip += ' - None done';
                  } else if (completedCount === 0 && partialCount > 0) {
                    colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                    tooltip += ' - Partial done';`);

// Consistency logic (overall)
code = code.replace(/h\.dates\.forEach\(dStr => \{\n\s*if \(\!isHabitDayFrozen\(h, dStr, todayStr\)\) \{\n\s*validComps\+\+;\n\s*\}\n\s*\}\);/g, `const tDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
      let todayIdx = today.getTime();
      let createTime = new Date(h.created + 'T12:00:00').getTime();
      let days = Math.floor((todayIdx - createTime) / (1000*60*60*24)) + 1;
      for(let i=0; i<days; i++) {
        let d = new Date(h.created + 'T12:00:00'); d.setDate(d.getDate() + i);
        let ds = formatDate(d);
        if (!isHabitDayFrozen(h, ds, todayStr) && checkDayStatus(h, ds) === 'completed') {
           validComps++;
        }
      }`);
      
// valid days possible (overall)
code = code.replace(/if \(\!isHabitDayFrozen\(h, dStr, todayStr\)\) \{\n\s*validDays\+\+;\n\s*if \(h\.dates\.includes\(dStr\)\) validCompletions\+\+;\n\s*\}/g, `if (!isHabitDayFrozen(h, dStr, todayStr)) {
          const tDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
          if (tDays.includes(d.getDay())) validDays++;
          if (checkDayStatus(h, dStr) === 'completed') validCompletions++;
        }`);

// Consistency logic (specific)
code = code.replace(/if \(\!isFrozen\) \{\n\s*validDaysSinceCreation\+\+;\n\s*if \(selectedHabit\.dates\.includes\(dStr\)\) validCompletions\+\+;\n\s*\}/g, `if (!isFrozen) {
        const tDays = selectedHabit.targetDays || [0, 1, 2, 3, 4, 5, 6];
        if (tDays.includes(d.getDay())) validDaysSinceCreation++;
        if (checkDayStatus(selectedHabit, dStr) === 'completed') validCompletions++;
      }`);
      
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
