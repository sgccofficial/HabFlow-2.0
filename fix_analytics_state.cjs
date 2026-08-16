const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

code = code.replace(/const \[selectedHabitId, setSelectedHabitId\] = useState<string>\(activeHabitId \|\| 'all'\);/, "const [selectedHabitId, setSelectedHabitId] = useState<string>(activeHabitId || 'all');\n  const [isTodayTasksOpen, setIsTodayTasksOpen] = useState(false);");

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
