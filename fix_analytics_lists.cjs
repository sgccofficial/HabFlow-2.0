const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const targetPill = `{todayCompletedHabits.length}`;
code = code.replace(targetPill, `{builtHabits.length} / {todayScheduledHabits.length}`);

// We need to inject the renderHabitList function above the return statement.
const helperFn = `  const renderHabitList = (habitList: typeof habits, showCheck: boolean) => (
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

  return (`;

code = code.replace("  return (", helperFn);

const targetDropdown = `{isTodayTasksOpen && (
                todayCompletedHabits.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {todayCompletedHabits.map(habit => {
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
                            {streak > 0 && (
                              <span className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1">
                                🔥 {streak}
                              </span>
                            )}
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    No builds completed yet today
                  </div>
                )
              )}`;

const replaceDropdown = `{isTodayTasksOpen && (
                <div className="space-y-4 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                  {builtHabits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Built</h4>
                      {renderHabitList(builtHabits, true)}
                    </div>
                  )}
                  {underConstructionHabits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Under Construction</h4>
                      {renderHabitList(underConstructionHabits, false)}
                    </div>
                  )}
                  {todayScheduledHabits.length === 0 && (
                    <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                      No tasks scheduled for today
                    </div>
                  )}
                </div>
              )}`;

code = code.replace(targetDropdown, replaceDropdown);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
