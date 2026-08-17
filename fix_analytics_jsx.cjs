const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// 1. Show chevron always
code = code.replace(/\{todayCompletedHabits\.length > 0 && \(\n\s*isTodayTasksOpen \? \(/, `{isTodayTasksOpen ? (`);

// 2. Fix the ternary for the list rendering
const targetJSX = `{todayCompletedHabits.length > 0 ? (
                isTodayTasksOpen && (
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
                )
              ) : (
                <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No builds completed yet today
                </div>
              )}`;

const replacementJSX = `{isTodayTasksOpen && (
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

code = code.replace(targetJSX, replacementJSX);

// Also fix the mb-3 logic which used todayCompletedHabits.length
code = code.replace(/className=\{cn\("flex items-center justify-between cursor-pointer group", \(todayCompletedHabits\.length > 0 && isTodayTasksOpen\) \? "mb-3" : ""\)\}/, 'className={cn("flex items-center justify-between cursor-pointer group", isTodayTasksOpen ? "mb-3" : "")}');

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
