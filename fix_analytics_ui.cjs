const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// Update pill text
code = code.replace(/\{todayCompletedHabits\.length\} \{todayCompletedHabits\.length === 1 \? 'build' : 'builds'\}/, "{todayCompletedHabits.length}");

// Reduce bulge
code = code.replace(/className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800"\s*>\s*<div \s*className="flex items-center justify-between mb-3 cursor-pointer group"/, `className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
              <div 
                className={cn("flex items-center justify-between cursor-pointer group", (todayCompletedHabits.length > 0 && isTodayTasksOpen) ? "mb-3" : "")}`);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
