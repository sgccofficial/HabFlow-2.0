const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const replacement = `  const renderHabitList = (habitList: typeof habits, showCheck: boolean) => (
    <div className="space-y-2">
      {habitList.map(habit => {
        const streak = calculateStreak(habit);
        return (
          <div
            key={habit.id}
            onClick={() => handleSelectHabit(habit.id)}
            role="button"
            tabIndex={0}
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/50 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: habit.color }}
              >
                {getIcon(habit.icon)}
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {habit.name}
                </h4>
                {habit.category && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 block truncate">
                    {habit.category}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {streak > 0 ? (
                <span className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1">
                  🔥 {streak}
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-1">
                  0
                </span>
              )}
              {showCheck && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderBlocks = (specificHabit?: any) => {
    const todayStr = formatDate(today);
    return (`

const fromStr = `  const renderHabitList = (habitList: typeof habits, showCheck: boolean) => (`;
const toStr = `  const renderBlocks = (specificHabit?: any) => {\n    const todayStr = formatDate(today);\n    return (`;

const startIdx = code.indexOf(fromStr);
const endIdx = code.indexOf(toStr) + toStr.length;

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  
  // also need to clean up any leftover `return (` from my previous regex
  // look at what is right before renderBlocks
  // I had code = code.replace(match[0], 'return (');
  // It probably put a bare `return (` somewhere where `renderHabitList` used to be!
  // Where was it originally? Right before the main `return (` of the component.
}

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
