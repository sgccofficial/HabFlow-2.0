const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');

const target = `  const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(null);`;
const replace = `  const [dataLoadedForUser, setDataLoadedForUser] = useState<string | null>(null);
  const isRemoteUpdate = useRef(false);`;

if(code.includes(target)) {
  code = code.replace(target, replace);
}

const onSnapStart = `const { onSnapshot } = await import('firebase/firestore');`;
const onSnapReplace = `const { onSnapshot } = await import('firebase/firestore');
          let initialLoad = true;
          unsubscribe = onSnapshot(doc(db, 'users', user.id), (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              isRemoteUpdate.current = true;
              if (data.habits) setHabits(prev => JSON.stringify(prev) !== JSON.stringify(data.habits) ? data.habits : prev);
              if (data.journal) setJournal(prev => JSON.stringify(prev) !== JSON.stringify(data.journal) ? data.journal : prev);
              if (data.journalSettings) setJournalSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.journalSettings) ? data.journalSettings : prev);
              if (data.appSettings) setAppSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.appSettings) ? data.appSettings : prev);
              setTimeout(() => { isRemoteUpdate.current = false; }, 500);
            }`;

code = code.replace(/const \{ onSnapshot \} = await import\('firebase\/firestore'\);[\s\S]*?if \(userDoc\.exists\(\)\) \{[\s\S]*?if \(data\.appSettings\) setAppSettings\(prev => JSON\.stringify\(prev\) !== JSON\.stringify\(data\.appSettings\) \? data\.appSettings : prev\);/m, onSnapReplace);

// Update all 4 useEffects
code = code.replace(/if \(user\) saveToFirebase\(\{ habits \}\);/, `if (user && !isRemoteUpdate.current) saveToFirebase({ habits });`);
code = code.replace(/if \(user\) saveToFirebase\(\{ journal \}\);/, `if (user && !isRemoteUpdate.current) saveToFirebase({ journal });`);
code = code.replace(/if \(user\) saveToFirebase\(\{ journalSettings \}\);/, `if (user && !isRemoteUpdate.current) saveToFirebase({ journalSettings });`);
code = code.replace(/if \(user\) saveToFirebase\(\{ appSettings \}\);/, `if (user && !isRemoteUpdate.current) saveToFirebase({ appSettings });`);

fs.writeFileSync('src/store/AppContext.tsx', code);
