const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/<CheckCircle2 className="w-5 h-5 text-emerald-500" \/>/, '<CheckCircle2 className="w-5 h-5 text-indigo-500" />');
code = code.replace(/bg-emerald-50 dark:bg-emerald-950\/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800\/30/g, 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30');

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
