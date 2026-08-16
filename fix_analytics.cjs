const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

// 1. Add ChevronUp and ChevronDown imports
if (!code.includes('ChevronUp')) {
  code = code.replace(/import \{ CheckCircle2, /, "import { CheckCircle2, ChevronUp, ChevronDown, ");
}

// 2. Add state for isTodayTasksOpen
code = code.replace(/const \[selectedHabitId, setSelectedHabitId\] = useState<string>\('all'\);/, "const [selectedHabitId, setSelectedHabitId] = useState<string>('all');\n  const [isTodayTasksOpen, setIsTodayTasksOpen] = useState(false);");

// 3. Update handleSelectHabit
code = code.replace(/const handleSelectHabit = \(id: string\) => \{\n\s*setSelectedHabitId\(id\);\n\s*setActiveHabitId\(id === 'all' \? null : id\);\n\s*\};/, `const handleSelectHabit = (id: string) => {
    setSelectedHabitId(id);
    setActiveHabitId(id === 'all' ? null : id);
    if (id !== 'all') {
      setTimeout(() => {
        const el = document.getElementById(\`habit-tab-\${id}\`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 50);
    }
  };`);

// 4. Add id to habit tabs
code = code.replace(/<button\n\s*key=\{h\.id\}/g, `<button\n              key={h.id}\n              id={\`habit-tab-\${h.id}\`}`);

// 5. Update Today's Completed Tasks section
code = code.replace(/<div className="flex items-center justify-between mb-3">/, `<div 
                className="flex items-center justify-between mb-3 cursor-pointer group"
                onClick={() => setIsTodayTasksOpen(!isTodayTasksOpen)}
                role="button"
              >`);

code = code.replace(/<span className="text-xs font-semibold px-2\.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950\/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800\/30">\n\s*\{todayCompletedHabits\.length\} \{todayCompletedHabits\.length === 1 \? 'task' : 'tasks'\}\n\s*<\/span>\n\s*<\/div>\n\n\s*\{todayCompletedHabits\.length > 0 \? \(/, `<div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                    {todayCompletedHabits.length} {todayCompletedHabits.length === 1 ? 'task' : 'tasks'}
                  </span>
                  {todayCompletedHabits.length > 0 && (
                    isTodayTasksOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    )
                  )}
                </div>
              </div>

              {todayCompletedHabits.length > 0 && isTodayTasksOpen ? (`);

fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
