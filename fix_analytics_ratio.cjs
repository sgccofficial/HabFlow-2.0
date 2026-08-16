const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const target = `} else if (ratio >= 0.4) {
                    colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                    tooltip += \` - \${completedCount}/\${activeCount} done\`;
                  } else {
                    colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                    tooltip += \` - \${completedCount}/\${activeCount} done\`;
                  }`;
                  
const replacement = `} else if (ratio >= 0.4 || partialCount > 0) {
                    colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                    tooltip += \` - \${completedCount}/\${activeCount} done\`;
                  } else {
                    colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                    tooltip += \` - \${completedCount}/\${activeCount} done\`;
                  }`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
