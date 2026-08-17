const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');

// Replace isRemoteUpdate with specific refs
code = code.replace(
  "const isRemoteUpdate = useRef(false);",
  `const lastSyncedHabits = useRef<string | null>(null);
  const lastSyncedJournal = useRef<string | null>(null);
  const lastSyncedJournalSettings = useRef<string | null>(null);
  const lastSyncedAppSettings = useRef<string | null>(null);`
);

// Update onSnapshot logic
const oldSnapshotLogic = `          unsubscribe = onSnapshot(doc(db, 'users', user.id), (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              isRemoteUpdate.current = true;
              if (data.habits) setHabits(prev => JSON.stringify(prev) !== JSON.stringify(data.habits) ? data.habits : prev);
              if (data.journal) setJournal(prev => JSON.stringify(prev) !== JSON.stringify(data.journal) ? data.journal : prev);
              if (data.journalSettings) setJournalSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.journalSettings) ? data.journalSettings : prev);
              if (data.appSettings) setAppSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.appSettings) ? data.appSettings : prev);
              setTimeout(() => { isRemoteUpdate.current = false; }, 500);
            }`;

const newSnapshotLogic = `          unsubscribe = onSnapshot(doc(db, 'users', user.id), (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.habits) {
                setHabits(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(data.habits)) {
                    lastSyncedHabits.current = JSON.stringify(data.habits);
                    return data.habits;
                  }
                  return prev;
                });
              }
              if (data.journal) {
                setJournal(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(data.journal)) {
                    lastSyncedJournal.current = JSON.stringify(data.journal);
                    return data.journal;
                  }
                  return prev;
                });
              }
              if (data.journalSettings) {
                setJournalSettings(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(data.journalSettings)) {
                    lastSyncedJournalSettings.current = JSON.stringify(data.journalSettings);
                    return data.journalSettings;
                  }
                  return prev;
                });
              }
              if (data.appSettings) {
                setAppSettings(prev => {
                  if (JSON.stringify(prev) !== JSON.stringify(data.appSettings)) {
                    lastSyncedAppSettings.current = JSON.stringify(data.appSettings);
                    return data.appSettings;
                  }
                  return prev;
                });
              }
            }`;
code = code.replace(oldSnapshotLogic, newSnapshotLogic);

// Update useEffects for sync
const updateEffect = (stateName, refName) => {
  const oldRegex = new RegExp(\`  useEffect\\(\\(\\) => \\{\\s+if \\(dataLoadedForUser === \\(user \\? user\\.id : null\\)\\) \\{\\s+localStorage\\.setItem\\(getStorageKey\\('habitflow_\${stateName === 'journalSettings' ? 'journal_settings' : stateName === 'appSettings' ? 'app_settings' : stateName}'\\), JSON\\.stringify\\(\${stateName}\\)\\);\\s+if \\(user && !isRemoteUpdate\\.current\\) saveToFirebase\\(\\{ \${stateName} \\}\\);([\\s\\S]*?)\\}  \\}, \\[\\${stateName}, user, dataLoadedForUser\\]\\);\\n?\`);
  
  const newEffect = `  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      const stateStr = JSON.stringify(${stateName});
      localStorage.setItem(getStorageKey('habitflow_${stateName === 'journalSettings' ? 'journal_settings' : stateName === 'appSettings' ? 'app_settings' : stateName}'), stateStr);
      if (user && ${refName}.current !== stateStr) {
        ${refName}.current = stateStr;
        saveToFirebase({ ${stateName} });
      }$1}
  }, [${stateName}, user, dataLoadedForUser]);
`;
  code = code.replace(oldRegex, newEffect);
};

updateEffect('habits', 'lastSyncedHabits');
updateEffect('journal', 'lastSyncedJournal');
updateEffect('journalSettings', 'lastSyncedJournalSettings');
updateEffect('appSettings', 'lastSyncedAppSettings');

fs.writeFileSync('src/store/AppContext.tsx', code);
