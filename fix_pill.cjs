const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace('{builtHabits.length} / {todayScheduledHabits.length}', '{builtHabits.length} / {underConstructionHabits.length}');

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
