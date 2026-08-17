const fs = require('fs');

// Fix HabitsPage
let habitsCode = fs.readFileSync('src/components/HabitsPage.tsx', 'utf8');
habitsCode = habitsCode.replace(/<div className="pb-24 pt-8 px-4">/, '<div className="pt-2 px-4">');
fs.writeFileSync('src/components/HabitsPage.tsx', habitsCode);

// Fix JournalPage
let journalCode = fs.readFileSync('src/components/JournalPage.tsx', 'utf8');
journalCode = journalCode.replace(/<div className="pb-24 pt-8 px-4">/, '<div className="pt-2 px-4">');
fs.writeFileSync('src/components/JournalPage.tsx', journalCode);

// App.tsx can keep pb-24 because we need space for the bottom nav everywhere!
