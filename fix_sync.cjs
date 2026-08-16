const fs = require('fs');
let code = fs.readFileSync('src/store/AppContext.tsx', 'utf8');

const target = `const userDoc = await getDoc(doc(db, 'users', user.id));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.habits) setHabits(data.habits);
            if (data.journal) setJournal(data.journal);
            if (data.journalSettings) setJournalSettings(data.journalSettings);
            if (data.appSettings) setAppSettings(data.appSettings);
          } else {
            // Migrate local to remote if there is anything
            const h = localStorage.getItem(\`habitflow_habits_\${user.id}\`);
            if (h) setHabits(JSON.parse(h));
            const j = localStorage.getItem(\`habitflow_journal_\${user.id}\`);
            if (j) setJournal(JSON.parse(j));
          }
          setDataLoadedForUser(user.id);`;

const replacement = `const { onSnapshot } = await import('firebase/firestore');
          
          let initialLoad = true;
          unsubscribe = onSnapshot(doc(db, 'users', user.id), (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.habits) setHabits(prev => JSON.stringify(prev) !== JSON.stringify(data.habits) ? data.habits : prev);
              if (data.journal) setJournal(prev => JSON.stringify(prev) !== JSON.stringify(data.journal) ? data.journal : prev);
              if (data.journalSettings) setJournalSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.journalSettings) ? data.journalSettings : prev);
              if (data.appSettings) setAppSettings(prev => JSON.stringify(prev) !== JSON.stringify(data.appSettings) ? data.appSettings : prev);
            } else if (initialLoad) {
              // Migrate local to remote if there is anything
              const h = localStorage.getItem(\`habitflow_habits_\${user.id}\`);
              if (h) setHabits(JSON.parse(h));
              const j = localStorage.getItem(\`habitflow_journal_\${user.id}\`);
              if (j) setJournal(JSON.parse(j));
            }
            if (initialLoad) {
              initialLoad = false;
              setDataLoadedForUser(user.id);
            }
          });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/store/AppContext.tsx', code);
