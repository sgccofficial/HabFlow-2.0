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

// Habits
code = code.replace(`  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      localStorage.setItem(getStorageKey('habitflow_habits'), JSON.stringify(habits));
      if (user && !isRemoteUpdate.current) saveToFirebase({ habits });
      syncNotificationSettings(habits);
    }
  }, [habits, user, dataLoadedForUser]);`, `  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      const stateStr = JSON.stringify(habits);
      localStorage.setItem(getStorageKey('habitflow_habits'), stateStr);
      if (user && lastSyncedHabits.current !== stateStr) {
        lastSyncedHabits.current = stateStr;
        saveToFirebase({ habits });
      }
      syncNotificationSettings(habits);
    }
  }, [habits, user, dataLoadedForUser]);`);

// Journal
code = code.replace(`  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      localStorage.setItem(getStorageKey('habitflow_journal'), JSON.stringify(journal));
      if (user && !isRemoteUpdate.current) saveToFirebase({ journal });
    }
  }, [journal, user, dataLoadedForUser]);`, `  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      const stateStr = JSON.stringify(journal);
      localStorage.setItem(getStorageKey('habitflow_journal'), stateStr);
      if (user && lastSyncedJournal.current !== stateStr) {
        lastSyncedJournal.current = stateStr;
        saveToFirebase({ journal });
      }
    }
  }, [journal, user, dataLoadedForUser]);`);

// Journal Settings
code = code.replace(`  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      localStorage.setItem(getStorageKey('habitflow_journal_settings'), JSON.stringify(journalSettings));
      if (user && !isRemoteUpdate.current) saveToFirebase({ journalSettings });
    }
  }, [journalSettings, user, dataLoadedForUser]);`, `  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      const stateStr = JSON.stringify(journalSettings);
      localStorage.setItem(getStorageKey('habitflow_journal_settings'), stateStr);
      if (user && lastSyncedJournalSettings.current !== stateStr) {
        lastSyncedJournalSettings.current = stateStr;
        saveToFirebase({ journalSettings });
      }
    }
  }, [journalSettings, user, dataLoadedForUser]);`);

// App Settings
code = code.replace(`  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      localStorage.setItem(getStorageKey('habitflow_app_settings'), JSON.stringify(appSettings));
      if (user && !isRemoteUpdate.current) saveToFirebase({ appSettings });
    }
  }, [appSettings, user, dataLoadedForUser]);`, `  useEffect(() => {
    if (dataLoadedForUser === (user ? user.id : null)) {
      const stateStr = JSON.stringify(appSettings);
      localStorage.setItem(getStorageKey('habitflow_app_settings'), stateStr);
      if (user && lastSyncedAppSettings.current !== stateStr) {
        lastSyncedAppSettings.current = stateStr;
        saveToFirebase({ appSettings });
      }
    }
  }, [appSettings, user, dataLoadedForUser]);`);

fs.writeFileSync('src/store/AppContext.tsx', code);
