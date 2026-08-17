const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(
  /"aspect-square rounded-xl transition-colors cursor-default",/,
  '"aspect-square rounded-xl sm:rounded-2xl transition-colors cursor-default",'
);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
