const fs = require('fs');
let code = fs.readFileSync('src/components/CalendarModal.tsx', 'utf8');

code = code.replace("isHabitDayFrozen, formatDate", "isHabitDayFrozen, formatDate, checkDayStatus");

code = code.replace(/const isCompleted = habit\.dates\.includes\(dStr\);/, "const status = checkDayStatus(habit, dStr);\n              const isCompleted = status === 'completed';\n              const isPartial = status === 'partial';");

code = code.replace(/} else if \(isCompleted\) {/, `} else if (isCompleted) {
                  bgColor = "bg-green-100 dark:bg-green-900/40";
                  textColor = "text-green-700 dark:text-green-400 font-bold";
                } else if (isPartial) {
                  bgColor = "bg-yellow-100 dark:bg-yellow-900/40";
                  textColor = "text-yellow-700 dark:text-yellow-400 font-bold";
                } else if (false) {`); // quick hack for else if replacement

code = code.replace(/} else if \(false\) \{\n\s*bgColor = "bg-green-100 dark:bg-green-900\/40";\n\s*textColor = "text-green-700 dark:text-green-400 font-bold";/, "");

fs.writeFileSync('src/components/CalendarModal.tsx', code);
