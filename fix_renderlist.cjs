const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// extract renderHabitList
const match = code.match(/const renderHabitList =[\s\S]*?\n  \);\n\n  return \(/);
if (match) {
  const renderHabitListBody = match[0].replace('  return (', '');
  code = code.replace(match[0], 'return ('); // put return back
  // Now place it before renderBlocks
  code = code.replace(/const renderBlocks =/, renderHabitListBody + '\n  const renderBlocks =');
  fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
} else {
  console.log("NOT FOUND");
}
