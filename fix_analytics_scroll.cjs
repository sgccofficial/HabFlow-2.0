const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/el\.scrollIntoView\(\{ behavior: 'smooth', inline: 'center', block: 'nearest' \}\);/, `el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          window.scrollTo({ top: 0, behavior: 'smooth' });`);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
