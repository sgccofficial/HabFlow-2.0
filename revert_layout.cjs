const fs = require('fs');

// 1. HabitsPage
let habits = fs.readFileSync('src/components/HabitsPage.tsx', 'utf8');
habits = habits.replace(/<div className="pt-2 px-4">/, '<div className="pb-24 pt-8 px-4">');
fs.writeFileSync('src/components/HabitsPage.tsx', habits);

// 2. JournalPage
let journal = fs.readFileSync('src/components/JournalPage.tsx', 'utf8');
journal = journal.replace(/<div className="pt-2 px-4">/, '<div className="pb-24 pt-8 px-4">');
fs.writeFileSync('src/components/JournalPage.tsx', journal);

// 3. AnalyticsPage
let analytics = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');
analytics = analytics.replace(/<div className="pt-2 px-4">/, '<div className="pb-24 pt-8 px-4">');
analytics = analytics.replace(/<div className="grid grid-cols-7 gap-2 mt-2 w-full max-w-\[280px\] sm:max-w-sm mx-auto">/, '<div className="grid grid-cols-7 gap-2 mt-2 w-full sm:max-w-md mx-auto">');
fs.writeFileSync('src/components/AnalyticsPage.tsx', analytics);

// 4. TimerPage
let timer = fs.readFileSync('src/components/TimerPage.tsx', 'utf8');
timer = timer.replace(/<div className="pt-2 px-4 flex flex-col items-center justify-center min-h-\[70vh\]">/, '<div className="pt-4 px-4 pb-4 flex flex-col items-center justify-center min-h-[calc(100dvh-6rem)] overflow-hidden">');
fs.writeFileSync('src/components/TimerPage.tsx', timer);

