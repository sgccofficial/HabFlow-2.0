const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/Today's Completed Tasks/g, "Today's Builds");
code = code.replace(/\{todayCompletedHabits\.length === 1 \? 'task' : 'tasks'\}/, "{todayCompletedHabits.length === 1 ? 'build' : 'builds'}");

const targetStr = `{todayCompletedHabits.length > 0 && isTodayTasksOpen ? (
                <div className="space-y-2 mt-3">
                  {todayCompletedHabits.map(habit => {`;
                  
const replacementStr = `{todayCompletedHabits.length > 0 ? (
                isTodayTasksOpen && (
                  <div className="space-y-2 mt-3">
                    {todayCompletedHabits.map(habit => {`;
                    
code = code.replace(targetStr, replacementStr);

const targetStr2 = `                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No tasks completed yet today
                </div>
              )}`;
              
const replacementStr2 = `                  })}
                  </div>
                )
              ) : (
                <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No builds completed yet today
                </div>
              )}`;

code = code.replace(targetStr2, replacementStr2);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
