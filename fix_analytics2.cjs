const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');
code = code.replace(/<div className="pt-2 px-4 pb-8">/, '<div className="pt-2 px-4">');
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
