const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/<div className="grid grid-cols-7 gap-2 mt-2 w-full max-w-\[280px\] sm:max-w-sm mx-auto">/g, '<div className="grid grid-cols-7 gap-2 mt-2 w-full sm:max-w-md mx-auto">');

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
