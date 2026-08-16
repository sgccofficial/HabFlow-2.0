const fs = require('fs');
let code = fs.readFileSync('src/components/JournalPage.tsx', 'utf8');

code = code.replace("{journalStats.topHabit && ` • Mostly about ${journalStats.topHabit.name}`}", "{journalStats.topHabit && !activeHabitId && ` • Mostly about ${journalStats.topHabit.name}`}");

fs.writeFileSync('src/components/JournalPage.tsx', code);
