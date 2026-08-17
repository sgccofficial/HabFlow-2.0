const fs = require('fs');

const files = [
  'src/components/JournalPage.tsx',
  'src/components/HabitsPage.tsx',
  'src/components/AnalyticsPage.tsx',
  'src/components/TimerPage.tsx' // Add timer if exists
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/max-w-md mx-auto/g, 'max-w-3xl mx-auto');
    fs.writeFileSync(file, code);
  }
});
