const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const target = `{streak > 0 ? (
                <span className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full border border-orange-100 dark:border-orange-800/30 flex items-center gap-1">
                  🔥 {streak}
                </span>
              ) : (`;

const replace = `{streak > 0 ? (
                <span className={\`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all \${showCheck ? 'text-orange-500 bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-800/30' : 'text-gray-400 bg-gray-100 dark:text-gray-500 dark:bg-gray-800 border-gray-200 dark:border-gray-700 grayscale opacity-70'}\`}>
                  🔥 {streak}
                </span>
              ) : (`;

code = code.replace(target, replace);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
