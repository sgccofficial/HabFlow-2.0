import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Habit, JournalEntry, Page, JournalSettings } from '../types';
import { formatDate, calculateStreak } from '../lib/utils';
import { mergeHabitLists, mergeJournalLists } from '../lib/syncUtils';

interface AppContextType {
  habits: Habit[];
  journal: JournalEntry[];
  journalSettings: Record<string, JournalSettings>;
  appSettings: JournalSettings;
  currentPage: Page;
  activeHabitId: string | null;
  user: any | null;
  setUser: (user: any | null) => void;
  createAccount: (username: string, displayName: string, photoURL: string, password: string) => Promise<void>;
  signInAccount: (username: string, password: string) => Promise<void>;
  signOutAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: number | null;
  setCurrentPage: (page: Page) => void;
  setActiveHabitId: (id: string | null) => void;
  updateJournalSettings: (habitId: string, settings: JournalSettings) => void;
  updateAppSettings: (settings: JournalSettings) => void;
  addHabit: (habit: Omit<Habit, 'id' | 'created' | 'dates'>) => void;
  updateHabit: (id: string, updates: Partial<Omit<Habit, 'id' | 'created'>>) => void;
  deleteHabit: (id: string) => void;
  reorderHabits: (newHabits: Habit[]) => void;
  toggleHabitDate: (id: string, date: string) => void;
  updateHabitProgress: (id: string, date: string, increment: number) => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  updateJournalEntry: (id: string, content: string) => void;
  deleteJournalEntry: (id: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  setServerTimer: (durationSecs: number, title: string) => void;
  clearServerTimer: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(() => {
    const saved = localStorage.getItem('habitflow_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const lastLocalEditTime = useRef<number>(0);
  const saveTimeoutRef = useRef<any>(null);
  const isLoggingOutRef = useRef<boolean>(false);
  const isSwitchingAccountRef = useRef<boolean>(false);
  const unsubscribeFirebaseRef = useRef<(() => void) | null>(null);
  const hasInitialRemoteSyncHappened = useRef<boolean>(false);

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const saved = localStorage.getItem('habitflow_last_synced_at');
    return saved ? Number(saved) : null;
  });

  const getStorageKey = (key: string, targetUser = user) => {
    if (targetUser && targetUser.id) {
      return `${key}_${targetUser.id}`;
    }
    return key.replace('habitflow_', 'habitflow_local_');
  };

  const [habits, setHabits] = useState<Habit[]>(() => {
    const savedUser = localStorage.getItem('habitflow_current_user');
    const u = savedUser ? JSON.parse(savedUser) : null;
    if (u && u.id) {
      const saved = localStorage.getItem(`habitflow_habits_${u.id}`);
      return saved ? JSON.parse(saved) : [];
    }
    // Strictly isolate local account habits
    const saved = localStorage.getItem('habitflow_local_habits');
    return saved ? JSON.parse(saved) : [];
  });

  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    const savedUser = localStorage.getItem('habitflow_current_user');
    const u = savedUser ? JSON.parse(savedUser) : null;
    if (u && u.id) {
      const saved = localStorage.getItem(`habitflow_journal_${u.id}`);
      return saved ? JSON.parse(saved) : [];
    }
    const saved = localStorage.getItem('habitflow_local_journal');
    return saved ? JSON.parse(saved) : [];
  });

  const [journalSettings, setJournalSettings] = useState<Record<string, JournalSettings>>(() => {
    const savedUser = localStorage.getItem('habitflow_current_user');
    const u = savedUser ? JSON.parse(savedUser) : null;
    if (u && u.id) {
      const saved = localStorage.getItem(`habitflow_journal_settings_${u.id}`);
      return saved ? JSON.parse(saved) : {};
    }
    const saved = localStorage.getItem('habitflow_local_journal_settings');
    return saved ? JSON.parse(saved) : {};
  });

  const [appSettings, setAppSettings] = useState<JournalSettings>(() => {
    const savedUser = localStorage.getItem('habitflow_current_user');
    const u = savedUser ? JSON.parse(savedUser) : null;
    if (u && u.id) {
      const saved = localStorage.getItem(`habitflow_app_settings_${u.id}`);
      return saved ? JSON.parse(saved) : {};
    }
    const saved = localStorage.getItem('habitflow_local_app_settings');
    return saved ? JSON.parse(saved) : {};
  });

  // Keep refs to latest states to prevent stale closure issues in background tasks & listeners
  const habitsRef = useRef(habits);
  useEffect(() => { habitsRef.current = habits; }, [habits]);
  const journalRef = useRef(journal);
  useEffect(() => { journalRef.current = journal; }, [journal]);
  const journalSettingsRef = useRef(journalSettings);
  useEffect(() => { journalSettingsRef.current = journalSettings; }, [journalSettings]);
  const appSettingsRef = useRef(appSettings);
  useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Critical: Initialize lastSyncedState with current state on mount so opening devices
  // never immediately overwrite Firebase with stale cached data before remote sync completes.
  const lastSyncedState = useRef({
    habits: JSON.stringify(habits),
    journal: JSON.stringify(journal),
    journalSettings: JSON.stringify(journalSettings),
    appSettings: JSON.stringify(appSettings)
  });

  // Dedicated immediate flush function for saving to Firestore without dropping writes when backgrounded
  const flushSaveToFirestore = async (
    targetHabits = habitsRef.current,
    targetJournal = journalRef.current,
    targetJS = journalSettingsRef.current,
    targetAS = appSettingsRef.current
  ) => {
    const targetUser = userRef.current;
    if (!targetUser || !targetUser.id || isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    try {
      const { db } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      const habitsStr = JSON.stringify(targetHabits);
      const journalStr = JSON.stringify(targetJournal);
      const jsStr = JSON.stringify(targetJS);
      const asStr = JSON.stringify(targetAS);

      lastSyncedState.current = {
        habits: habitsStr,
        journal: journalStr,
        journalSettings: jsStr,
        appSettings: asStr
      };

      const now = Date.now();
      const cleanData: any = {
        habits: JSON.parse(habitsStr),
        journal: JSON.parse(journalStr),
        journalSettings: JSON.parse(jsStr),
        appSettings: JSON.parse(asStr),
        lastUpdated: now
      };

      await setDoc(doc(db, 'users', targetUser.id), cleanData, { merge: true });
      const storageKey = getStorageKey('habitflow_habits', targetUser);
      localStorage.setItem(storageKey, habitsStr);
      setSyncStatus('synced');
      setLastSyncedAt(now);
      localStorage.setItem('habitflow_last_synced_at', String(now));
    } catch (err) {
      console.warn("Silent save to Firestore warning:", err);
    }
  };

  // Immediate flush on page hide/unload/visibility change to prevent lost data on mobile sleep/close
  useEffect(() => {
    const handleFlush = () => {
      if (userRef.current && userRef.current.id) {
        flushSaveToFirestore();
      }
    };

    window.addEventListener('pagehide', handleFlush);
    window.addEventListener('beforeunload', handleFlush);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pagehide', handleFlush);
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Listen to Firebase Auth state for automatic seamless silent session recovery across devices
  useEffect(() => {
    let unsubscribeAuth: (() => void) | null = null;
    (async () => {
      try {
        const { auth, db } = await import('../lib/firebase');
        const { onAuthStateChanged } = await import('firebase/auth');
        const { doc, getDoc } = await import('firebase/firestore');

        unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
          if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
          if (firebaseUser && !userRef.current) {
            try {
              const uDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                const restoredUser = {
                  id: firebaseUser.uid,
                  username: uData.username || firebaseUser.email?.replace(/@.*$/, '') || 'user',
                  name: uData.name || firebaseUser.displayName || 'User',
                  photoURL: uData.photoURL || firebaseUser.photoURL || ''
                };
                localStorage.setItem('habitflow_current_user', JSON.stringify(restoredUser));
                setUser(restoredUser);
              }
            } catch (err) {
              console.warn("Silent auth restore error:", err);
            }
          }
        });
      } catch (err) {
        console.warn("Auth listener setup error:", err);
      }
    })();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  // Cross-tab sync: instantly synchronize habit done/not done status across multiple browser tabs on same device
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
      const habitsKey = getStorageKey('habitflow_habits');
      const journalKey = getStorageKey('habitflow_journal');
      const jSettingsKey = getStorageKey('habitflow_journal_settings');
      const appSettingsKey = getStorageKey('habitflow_app_settings');

      if (e.key === habitsKey && e.newValue) {
        try {
          const parsed: Habit[] = JSON.parse(e.newValue);
          setHabits(prev => mergeHabitLists(prev, parsed));
        } catch (err) {}
      } else if (e.key === journalKey && e.newValue) {
        try {
          const parsed: JournalEntry[] = JSON.parse(e.newValue);
          setJournal(prev => mergeJournalLists(prev, parsed));
        } catch (err) {}
      } else if (e.key === jSettingsKey && e.newValue) {
        try {
          setJournalSettings(JSON.parse(e.newValue));
        } catch (err) {}
      } else if (e.key === appSettingsKey && e.newValue) {
        try {
          setAppSettings(JSON.parse(e.newValue));
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  // 1. Instant local persistence: save to localStorage on every change
  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    const key = getStorageKey('habitflow_habits');
    localStorage.setItem(key, JSON.stringify(habits));
    syncNotificationSettings(habits);
  }, [habits, user]);

  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    const key = getStorageKey('habitflow_journal');
    localStorage.setItem(key, JSON.stringify(journal));
  }, [journal, user]);

  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    const key = getStorageKey('habitflow_journal_settings');
    localStorage.setItem(key, JSON.stringify(journalSettings));
  }, [journalSettings, user]);

  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    const key = getStorageKey('habitflow_app_settings');
    localStorage.setItem(key, JSON.stringify(appSettings));
  }, [appSettings, user]);

  // 2. Debounced save to Firebase when state changes (ONLY for authenticated cloud accounts)
  useEffect(() => {
    if (!user || !user.id || isLoggingOutRef.current || isSwitchingAccountRef.current) return;

    // Guard: Prevent saving to Firebase on startup until the initial remote sync has occurred,
    // unless the user made an explicit local action after page load.
    if (!hasInitialRemoteSyncHappened.current && lastLocalEditTime.current === 0) {
      return;
    }

    const habitsStr = JSON.stringify(habits);
    const journalStr = JSON.stringify(journal);
    const journalSettingsStr = JSON.stringify(journalSettings);
    const appSettingsStr = JSON.stringify(appSettings);

    const hasHabitsChanged = habitsStr !== lastSyncedState.current.habits;
    const hasJournalChanged = journalStr !== lastSyncedState.current.journal;
    const hasJSettingsChanged = journalSettingsStr !== lastSyncedState.current.journalSettings;
    const hasASettingsChanged = appSettingsStr !== lastSyncedState.current.appSettings;

    if (!hasHabitsChanged && !hasJournalChanged && !hasJSettingsChanged && !hasASettingsChanged) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const currentUserId = user.id;

    saveTimeoutRef.current = setTimeout(async () => {
      // Guard against writing if logged out or if user changed
      if (isLoggingOutRef.current || !currentUserId || isSwitchingAccountRef.current) return;
      try {
        setSyncStatus('syncing');
        const { db } = await import('../lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');

        lastSyncedState.current = {
          habits: habitsStr,
          journal: journalStr,
          journalSettings: journalSettingsStr,
          appSettings: appSettingsStr,
        };

        const now = Date.now();
        const cleanData: any = {
          habits: JSON.parse(habitsStr),
          journal: JSON.parse(journalStr),
          journalSettings: JSON.parse(journalSettingsStr),
          appSettings: JSON.parse(appSettingsStr),
          lastUpdated: now
        };

        await setDoc(doc(db, 'users', currentUserId), cleanData, { merge: true });
        setSyncStatus('synced');
        setLastSyncedAt(now);
        localStorage.setItem('habitflow_last_synced_at', String(now));
      } catch (error) {
        console.error("Failed to save to Firebase:", error);
        setSyncStatus('error');
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [habits, journal, journalSettings, appSettings, user]);

  // 3. Multi-device sync and load on user switch / mount
  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;

    if (unsubscribeFirebaseRef.current) {
      unsubscribeFirebaseRef.current();
      unsubscribeFirebaseRef.current = null;
    }

    if (user && user.id) {
      localStorage.setItem('habitflow_current_user', JSON.stringify(user));

      // Immediately restore this user's local cached data (instant, no flicker)
      const userHabitsKey = `habitflow_habits_${user.id}`;
      const userJournalKey = `habitflow_journal_${user.id}`;
      const userJSettingsKey = `habitflow_journal_settings_${user.id}`;
      const userASettingsKey = `habitflow_app_settings_${user.id}`;

      const localH = localStorage.getItem(userHabitsKey);
      const localJ = localStorage.getItem(userJournalKey);
      const localJS = localStorage.getItem(userJSettingsKey);
      const localAS = localStorage.getItem(userASettingsKey);

      let currentH: Habit[] = habits;
      let currentJ: JournalEntry[] = journal;
      let currentJS: Record<string, JournalSettings> = journalSettings;
      let currentAS: JournalSettings = appSettings;

      if (localH) {
        currentH = JSON.parse(localH);
        setHabits(currentH);
      }
      if (localJ) {
        currentJ = JSON.parse(localJ);
        setJournal(currentJ);
      }
      if (localJS) {
        currentJS = JSON.parse(localJS);
        setJournalSettings(currentJS);
      }
      if (localAS) {
        currentAS = JSON.parse(localAS);
        setAppSettings(currentAS);
      }

      const loadFirebaseData = async () => {
        try {
          const { db } = await import('../lib/firebase');
          const { doc, onSnapshot, getDoc, setDoc } = await import('firebase/firestore');

          const userDocRef = doc(db, 'users', user.id);

          // Phase 1: Fast initial fetch & CRDT merge
          try {
            setSyncStatus('syncing');
            const initialSnap = await getDoc(userDocRef);
            if (initialSnap.exists()) {
              const remoteData = initialSnap.data();

              if (remoteData.habits && Array.isArray(remoteData.habits)) {
                setHabits(prevHabits => {
                  const merged = mergeHabitLists(prevHabits, remoteData.habits);
                  habitsRef.current = merged;
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.habits = str;
                  localStorage.setItem(userHabitsKey, str);
                  // If local had dates or updates not yet on remote, persist back immediately
                  if (str !== JSON.stringify(remoteData.habits)) {
                    setDoc(userDocRef, { habits: merged, lastUpdated: Date.now() }, { merge: true }).catch(() => {});
                  }
                  return merged;
                });
              }

              if (remoteData.journal && Array.isArray(remoteData.journal)) {
                setJournal(prevJournal => {
                  const merged = mergeJournalLists(prevJournal, remoteData.journal);
                  journalRef.current = merged;
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.journal = str;
                  localStorage.setItem(userJournalKey, str);
                  return merged;
                });
              }

              if (remoteData.journalSettings) {
                setJournalSettings(prev => {
                  const merged = { ...prev, ...remoteData.journalSettings };
                  journalSettingsRef.current = merged;
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.journalSettings = str;
                  localStorage.setItem(userJSettingsKey, str);
                  return merged;
                });
              }

              if (remoteData.appSettings) {
                setAppSettings(prev => {
                  const merged = { ...prev, ...remoteData.appSettings };
                  appSettingsRef.current = merged;
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.appSettings = str;
                  localStorage.setItem(userASettingsKey, str);
                  return merged;
                });
              }

              const now = Date.now();
              setSyncStatus('synced');
              setLastSyncedAt(now);
              localStorage.setItem('habitflow_last_synced_at', String(now));
            } else {
              // Remote document does not exist yet; initialize with local data
              const now = Date.now();
              const initialData = {
                id: user.id,
                username: user.username,
                name: user.name || user.username,
                photoURL: user.photoURL || '',
                habits: currentH,
                journal: currentJ,
                journalSettings: currentJS,
                appSettings: currentAS,
                createdAt: now,
                lastUpdated: now
              };
              await setDoc(userDocRef, initialData, { merge: true });
              setSyncStatus('synced');
              setLastSyncedAt(now);
              localStorage.setItem('habitflow_last_synced_at', String(now));
            }
          } catch (fetchErr) {
            console.warn("Initial user doc fetch warning:", fetchErr);
            setSyncStatus('error');
          } finally {
            hasInitialRemoteSyncHappened.current = true;
          }

          // Phase 2: Live real-time bidirectional sync listener across all devices
          const unsub = onSnapshot(
            userDocRef,
            (userDoc) => {
              if (userDoc.metadata.hasPendingWrites) {
                return; // ignore local optimistic writes currently in flight
              }

              if (userDoc.exists()) {
                const data = userDoc.data();

                if (data.habits && Array.isArray(data.habits)) {
                  setHabits(prevHabits => {
                    const merged = mergeHabitLists(prevHabits, data.habits);
                    const str = JSON.stringify(merged);
                    if (str !== JSON.stringify(prevHabits)) {
                      habitsRef.current = merged;
                      lastSyncedState.current.habits = str;
                      localStorage.setItem(userHabitsKey, str);
                      return merged;
                    }
                    return prevHabits;
                  });
                }

                if (data.journal && Array.isArray(data.journal)) {
                  setJournal(prevJournal => {
                    const merged = mergeJournalLists(prevJournal, data.journal);
                    const str = JSON.stringify(merged);
                    if (str !== JSON.stringify(prevJournal)) {
                      journalRef.current = merged;
                      lastSyncedState.current.journal = str;
                      localStorage.setItem(userJournalKey, str);
                      return merged;
                    }
                    return prevJournal;
                  });
                }

                if (data.journalSettings) {
                  const str = JSON.stringify(data.journalSettings);
                  if (str !== lastSyncedState.current.journalSettings) {
                    lastSyncedState.current.journalSettings = str;
                    journalSettingsRef.current = data.journalSettings;
                    setJournalSettings(data.journalSettings);
                    localStorage.setItem(userJSettingsKey, str);
                  }
                }

                if (data.appSettings) {
                  const str = JSON.stringify(data.appSettings);
                  if (str !== lastSyncedState.current.appSettings) {
                    lastSyncedState.current.appSettings = str;
                    appSettingsRef.current = data.appSettings;
                    setAppSettings(data.appSettings);
                    localStorage.setItem(userASettingsKey, str);
                  }
                }

                const now = Date.now();
                setSyncStatus('synced');
                setLastSyncedAt(now);
                localStorage.setItem('habitflow_last_synced_at', String(now));
              }
            },
            (error) => {
              console.warn("Firestore snapshot listener error:", error);
              setSyncStatus('error');
            }
          );
          unsubscribeFirebaseRef.current = unsub;
        } catch (error) {
          console.error("Failed to load Firebase data:", error);
          setSyncStatus('error');
        }
      };

      loadFirebaseData();
    } else {
      localStorage.removeItem('habitflow_current_user');
      const h = localStorage.getItem('habitflow_local_habits');
      setHabits(h ? JSON.parse(h) : []);
      const j = localStorage.getItem('habitflow_local_journal');
      setJournal(j ? JSON.parse(j) : []);
      const js = localStorage.getItem('habitflow_local_journal_settings');
      setJournalSettings(js ? JSON.parse(js) : {});
      const as = localStorage.getItem('habitflow_local_app_settings');
      setAppSettings(as ? JSON.parse(as) : {});
      setSyncStatus('idle');
    }

    return () => {
      if (unsubscribeFirebaseRef.current) {
        unsubscribeFirebaseRef.current();
        unsubscribeFirebaseRef.current = null;
      }
    };
  }, [user]);

  // Silent automatic sync function (no UI prompts or clutter)
  const syncNow = async () => {
    if (!user || !user.id) return;
    try {
      const { db } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', user.id);
      const snap = await getDoc(userDocRef);

      let currentHabits = habitsRef.current;
      let currentJournal = journalRef.current;
      let currentJS = journalSettingsRef.current;
      let currentAS = appSettingsRef.current;

      if (snap.exists()) {
        const remoteData = snap.data();
        if (remoteData.habits && Array.isArray(remoteData.habits)) {
          currentHabits = mergeHabitLists(habitsRef.current, remoteData.habits);
          setHabits(currentHabits);
          habitsRef.current = currentHabits;
          const str = JSON.stringify(currentHabits);
          localStorage.setItem(getStorageKey('habitflow_habits', user), str);
          lastSyncedState.current.habits = str;
        }
        if (remoteData.journal && Array.isArray(remoteData.journal)) {
          currentJournal = mergeJournalLists(journalRef.current, remoteData.journal);
          setJournal(currentJournal);
          journalRef.current = currentJournal;
          const str = JSON.stringify(currentJournal);
          localStorage.setItem(getStorageKey('habitflow_journal', user), str);
          lastSyncedState.current.journal = str;
        }
        if (remoteData.journalSettings) {
          currentJS = { ...journalSettingsRef.current, ...remoteData.journalSettings };
          setJournalSettings(currentJS);
          journalSettingsRef.current = currentJS;
          const str = JSON.stringify(currentJS);
          localStorage.setItem(getStorageKey('habitflow_journal_settings', user), str);
          lastSyncedState.current.journalSettings = str;
        }
        if (remoteData.appSettings) {
          currentAS = { ...appSettingsRef.current, ...remoteData.appSettings };
          setAppSettings(currentAS);
          appSettingsRef.current = currentAS;
          const str = JSON.stringify(currentAS);
          localStorage.setItem(getStorageKey('habitflow_app_settings', user), str);
          lastSyncedState.current.appSettings = str;
        }
      }

      // Persist the unified merged state back to Firestore silently
      const now = Date.now();
      const cleanData: any = {
        habits: currentHabits,
        journal: currentJournal,
        journalSettings: currentJS,
        appSettings: currentAS,
        lastUpdated: now
      };
      await setDoc(userDocRef, cleanData, { merge: true });
    } catch (e) {
      console.warn("Silent sync attempt:", e);
    }
  };

  // Silent automatic sync when switching back to tab/app or coming online
  useEffect(() => {
    if (!user || !user.id) return;

    const handleSilentSync = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        syncNow();
      }
    };

    window.addEventListener('visibilitychange', handleSilentSync);
    window.addEventListener('focus', handleSilentSync);
    window.addEventListener('online', handleSilentSync);

    return () => {
      window.removeEventListener('visibilitychange', handleSilentSync);
      window.removeEventListener('focus', handleSilentSync);
      window.removeEventListener('online', handleSilentSync);
    };
  }, [user]);

  // When a user "creates an account", sync all locally saved content to his account,
  // and save further changes in his account - not to local.
  // The local account remains intact with the data left off up to account creation.
  const createAccount = async (username: string, displayName: string, photoURL: string, pwd: string) => {
    isSwitchingAccountRef.current = true;
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { auth, db } = await import('../lib/firebase');
      const { doc, setDoc, getDoc } = await import('firebase/firestore');

      const userDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
      if (userDoc.exists()) {
        throw new Error("An account with this username already exists.");
      }

      const email = `${username.toLowerCase()}@habitflow.local`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, pwd);
      const uid = userCredential.user.uid;

      // Sync all locally saved content to his new account
      const localH = localStorage.getItem('habitflow_local_habits');
      const localJ = localStorage.getItem('habitflow_local_journal');
      const localJS = localStorage.getItem('habitflow_local_journal_settings');
      const localAS = localStorage.getItem('habitflow_local_app_settings');

      const initialHabits: Habit[] = localH ? JSON.parse(localH) : habits;
      const initialJournal: JournalEntry[] = localJ ? JSON.parse(localJ) : journal;
      const initialJS: Record<string, JournalSettings> = localJS ? JSON.parse(localJS) : journalSettings;
      const initialAS: JournalSettings = localAS ? JSON.parse(localAS) : appSettings;

      const newUserDoc = {
        id: uid,
        username,
        name: displayName,
        photoURL: photoURL || '',
        habits: initialHabits,
        journal: initialJournal,
        journalSettings: initialJS,
        appSettings: initialAS,
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid });
      await setDoc(doc(db, 'users', uid), newUserDoc);

      // Save to this user's isolated local cache
      localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(initialHabits));
      localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(initialJournal));
      localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(initialJS));
      localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(initialAS));

      const userInfo = {
        id: uid,
        username,
        name: displayName,
        photoURL: photoURL || ''
      };
      localStorage.setItem('habitflow_current_user', JSON.stringify(userInfo));

      // Notice: habitflow_local_* is preserved untouched!
      // When the user later logs off, the local account will have the data that was left off up to the point where the user created an account!

      lastSyncedState.current = {
        habits: JSON.stringify(initialHabits),
        journal: JSON.stringify(initialJournal),
        journalSettings: JSON.stringify(initialJS),
        appSettings: JSON.stringify(initialAS)
      };

      setHabits(initialHabits);
      setJournal(initialJournal);
      setJournalSettings(initialJS);
      setAppSettings(initialAS);
      setUser(userInfo);
    } finally {
      setTimeout(() => {
        isSwitchingAccountRef.current = false;
      }, 200);
    }
  };

  // When the user signs in from any device, merge any local device progress non-destructively with cloud data
  const signInAccount = async (username: string, pwd: string) => {
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth, db } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');

      const email = `${username.toLowerCase()}@habitflow.local`;
      const userCredential = await signInWithEmailAndPassword(auth, email, pwd);
      const uid = userCredential.user.uid;

      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        throw new Error("Account data not found.");
      }

      const data = userDoc.data();
      const cloudHabits: Habit[] = Array.isArray(data.habits) ? data.habits : [];
      const cloudJournal: JournalEntry[] = Array.isArray(data.journal) ? data.journal : [];
      const cloudJS: Record<string, JournalSettings> = data.journalSettings || {};
      const cloudAS: JournalSettings = data.appSettings || {};

      // Check for any local device habits (e.g. from guest mode or offline device usage)
      const cachedUserHabitsStr = localStorage.getItem(`habitflow_habits_${uid}`);
      const localHabitsStr = localStorage.getItem('habitflow_local_habits');
      const existingDeviceHabits: Habit[] = cachedUserHabitsStr 
        ? JSON.parse(cachedUserHabitsStr) 
        : (localHabitsStr ? JSON.parse(localHabitsStr) : []);

      // Non-destructively merge device habits with cloud habits so no completions are ever lost
      const unifiedHabits = mergeHabitLists(existingDeviceHabits, cloudHabits);

      const cachedJournalStr = localStorage.getItem(`habitflow_journal_${uid}`);
      const localJournalStr = localStorage.getItem('habitflow_local_journal');
      const existingDeviceJournal: JournalEntry[] = cachedJournalStr 
        ? JSON.parse(cachedJournalStr) 
        : (localJournalStr ? JSON.parse(localJournalStr) : []);
      const unifiedJournal = mergeJournalLists(existingDeviceJournal, cloudJournal);

      // If local device had new dates/progress not yet on cloud, persist immediately to Firestore
      if (JSON.stringify(unifiedHabits) !== JSON.stringify(cloudHabits) || JSON.stringify(unifiedJournal) !== JSON.stringify(cloudJournal)) {
        await setDoc(doc(db, 'users', uid), { 
          habits: unifiedHabits, 
          journal: unifiedJournal, 
          lastUpdated: Date.now() 
        }, { merge: true });
      }

      // Write to user's storage keys
      localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(unifiedHabits));
      localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(unifiedJournal));
      localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(cloudJS));
      localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(cloudAS));

      const userInfo = {
        id: uid,
        username: data.username || username,
        name: data.name || username,
        photoURL: data.photoURL || ''
      };
      localStorage.setItem('habitflow_current_user', JSON.stringify(userInfo));

      lastSyncedState.current = {
        habits: JSON.stringify(unifiedHabits),
        journal: JSON.stringify(unifiedJournal),
        journalSettings: JSON.stringify(cloudJS),
        appSettings: JSON.stringify(cloudAS)
      };

      setHabits(unifiedHabits);
      setJournal(unifiedJournal);
      setJournalSettings(cloudJS);
      setAppSettings(cloudAS);
      setUser(userInfo);
    } catch (err) {
      throw err;
    }
  };

  const signOutAccount = async () => {
    isLoggingOutRef.current = true;

    // 1. Immediately cancel any scheduled sync/write to Firebase
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // 2. Unsubscribe any active Firestore listeners
    if (unsubscribeFirebaseRef.current) {
      unsubscribeFirebaseRef.current();
      unsubscribeFirebaseRef.current = null;
    }

    // 3. Clear user session
    localStorage.removeItem('habitflow_current_user');

    // 4. Remove any stale/legacy keys to prevent leakage
    localStorage.removeItem('habitflow_habits');
    localStorage.removeItem('habitflow_journal');
    localStorage.removeItem('habitflow_journal_settings');
    localStorage.removeItem('habitflow_app_settings');

    // 5. Sign out of Firebase Auth
    try {
      const { auth } = await import('../lib/firebase');
      await auth.signOut();
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }

    // 6. Restore the dedicated local account (clean, independent from previous user's tasks)
    // Local account has the data that was left off up to the point where the user created an account!
    const localH = localStorage.getItem('habitflow_local_habits');
    const localJ = localStorage.getItem('habitflow_local_journal');
    const localJS = localStorage.getItem('habitflow_local_journal_settings');
    const localAS = localStorage.getItem('habitflow_local_app_settings');

    setHabits(localH ? JSON.parse(localH) : []);
    setJournal(localJ ? JSON.parse(localJ) : []);
    setJournalSettings(localJS ? JSON.parse(localJS) : {});
    setAppSettings(localAS ? JSON.parse(localAS) : {});
    setActiveHabitId(null);
    setUser(null);

    lastSyncedState.current = { habits: '', journal: '', journalSettings: '', appSettings: '' };

    setTimeout(() => {
      isLoggingOutRef.current = false;
    }, 100);
  };

  const setUserAndBackup = (newUser: any) => {
    setUser(newUser);
  };

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const saved = localStorage.getItem('habitflow_current_page');
    return (saved as Page) || 'habits';
  });

  useEffect(() => {
    localStorage.setItem('habitflow_current_page', currentPage);
  }, [currentPage]);

  const [activeHabitId, setActiveHabitId] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('habitflow_darkmode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        if (localStorage.getItem('habitflow_darkmode') === null) {
          setDarkMode(e.matches);
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const [swSubscription, setSwSubscription] = useState<any>(null);

  const updateJournalSettings = (habitId: string, settings: JournalSettings) => {
    lastLocalEditTime.current = Date.now();
    setJournalSettings(prev => ({ ...prev, [habitId]: { ...prev[habitId], ...settings } }));
  };

  useEffect(() => {
    if (swSubscription) {
      syncNotificationSettings(habits, swSubscription);
    }
  }, [habits, swSubscription]);

  const updateAppSettings = (settings: JournalSettings) => {
    lastLocalEditTime.current = Date.now();
    setAppSettings(prev => ({ ...prev, ...settings }));
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Request notification permission on startup and initialize SW
  useEffect(() => {
    const initSW = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          
          if (Notification.permission === 'granted') {
            await subscribeUser(registration);
          } else if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              await subscribeUser(registration);
            }
          }
        } catch (error) {
          console.error('Service Worker Registration Failed', error);
        }
      }
    };
    initSW();
  }, []);

  const subscribeUser = async (registration: ServiceWorkerRegistration) => {
    try {
      const response = await fetch('/api/vapidPublicKey');
      const vapidPublicKey = await response.text();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      setSwSubscription(subscription);

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
      console.log('Subscribed to push notifications');
      syncNotificationSettings(habits, subscription);
    } catch (err) {
      console.error('Failed to subscribe to push', err);
    }
  };

  const syncNotificationSettings = async (currentHabits: Habit[], subscription: any = swSubscription) => {
    if (!subscription) return;

    const dailyReminders = currentHabits
      .filter(h => h.reminderTime && !h.isFrozen)
      .map(h => ({
        title: h.name,
        time: h.reminderTime,
        lastSentDay: null, // initial
        targetDays: h.targetDays,
        dates: h.dates,
        streak: calculateStreak(h)
      }));

    try {
      await fetch('/api/sync-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription: subscription,
          dailyReminders,
          timezoneOffset: new Date().getTimezoneOffset()
        })
      });
    } catch (e) {
      console.error('Sync failed', e);
    }
  };

  const setServerTimer = async (durationSecs: number, title: string) => {
    if (!swSubscription) return;
    
    // We get current daily reminders
    const dailyReminders = habits
      .filter(h => h.reminderTime && !h.isFrozen)
      .map(h => ({ title: h.name, time: h.reminderTime, lastSentDay: null, targetDays: h.targetDays, dates: h.dates, streak: calculateStreak(h) }));

    const timerObj = {
      title: "Time's Up !!",
      body: `You should have completed ${title} by now 😉`,
      time: Date.now() + (durationSecs * 1000),
      sent: false
    };

    try {
      await fetch('/api/sync-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription: swSubscription,
          activeTimers: [timerObj],
          dailyReminders,
          timezoneOffset: new Date().getTimezoneOffset()
        })
      });
    } catch (e) {
      console.error('Timer sync failed', e);
    }
  };

  const clearServerTimer = async () => {
    if (!swSubscription) return;
    const dailyReminders = habits
      .filter(h => h.reminderTime && !h.isFrozen)
      .map(h => ({ title: h.name, time: h.reminderTime, lastSentDay: null, targetDays: h.targetDays, dates: h.dates, streak: calculateStreak(h) }));

    try {
      await fetch('/api/sync-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          subscription: swSubscription,
          activeTimers: [],
          dailyReminders,
          timezoneOffset: new Date().getTimezoneOffset()
        })
      });
    } catch (e) {}
  };

  // Utility function for vapid
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('habitflow_darkmode', JSON.stringify(newMode));
      return newMode;
    });
  };

  const addHabit = (habitData: Omit<Habit, 'id' | 'created' | 'dates'>) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const todayStr = formatDate(new Date());
    const newHabit: Habit = {
      ...habitData,
      id: crypto.randomUUID(),
      created: todayStr,
      dates: [],
      progress: {},
      completedAt: {},
      uncompletedAt: {},
      updatedAt: now,
      scheduleHistory: [{
        effectiveFrom: todayStr,
        targetDays: habitData.targetDays || [0, 1, 2, 3, 4, 5, 6],
        dailyCompletions: habitData.dailyCompletions ?? 1,
        durationGoal: habitData.durationGoal ?? 0,
        goalType: habitData.goalType,
        goalValue: habitData.goalValue,
        reminderTime: habitData.reminderTime
      }]
    };
    setHabits(prev => [...prev, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<Omit<Habit, 'id' | 'created'>>) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates, updatedAt: now } : h));
  };

  const deleteHabit = (id: string) => {
    lastLocalEditTime.current = Date.now();
    setHabits(prev => prev.filter(h => h.id !== id));
    setJournal(prev => prev.filter(j => j.habitId !== id));
    if (activeHabitId === id) setActiveHabitId(null);
  };

  const reorderHabits = (newHabits: Habit[]) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    setHabits(newHabits.map(h => ({ ...h, updatedAt: now })));
  };

  const toggleHabitDate = (id: string, date: string) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    setHabits(prev => {
      const nextHabits = prev.map(h => {
        if (h.id === id) {
          const isCurrentlyDone = (h.dates || []).includes(date);
          const dates = isCurrentlyDone
            ? (h.dates || []).filter(d => d !== date)
            : [...(h.dates || []), date];
          
          const completedAt = { ...(h.completedAt || {}) };
          const uncompletedAt = { ...(h.uncompletedAt || {}) };

          if (!isCurrentlyDone) {
            completedAt[date] = now;
          } else {
            uncompletedAt[date] = now;
          }

          // Also sync with progress object
          const progress = { ...(h.progress || {}) };
          if (!isCurrentlyDone) {
            const isTimely = h.durationGoal !== undefined ? h.durationGoal > 0 : h.goalType === 'duration';
            const durationGoal = h.durationGoal || (h.goalType === 'duration' ? (h.durationUnit === 'hr' ? (h.goalValue || 0) * 3600 : h.durationUnit === 'min' ? (h.goalValue || 0) * 60 : (h.goalValue || 0)) : 0);
            const isDaily = h.dailyCompletions !== undefined ? h.dailyCompletions > 0 : (h.goalType === 'daily' || h.goalType === 'weekly');
            const dailyCompletions = h.dailyCompletions || ((h.goalType === 'daily' || h.goalType === 'weekly') ? h.goalValue || 1 : 1);
            
            let targetValue = 1;
            if (isTimely) {
              targetValue = durationGoal * (isDaily ? dailyCompletions : 1);
            } else if (isDaily) {
              targetValue = dailyCompletions;
            }
            
            progress[date] = targetValue; // if they check it, set to goal
          } else {
            progress[date] = 0;
          }
          
          return {
            ...h,
            dates,
            progress,
            completedAt,
            uncompletedAt,
            updatedAt: now
          };
        }
        return h;
      });

      habitsRef.current = nextHabits;
      const key = getStorageKey('habitflow_habits', userRef.current);
      localStorage.setItem(key, JSON.stringify(nextHabits));

      if (userRef.current && userRef.current.id) {
        flushSaveToFirestore(nextHabits);
      }

      return nextHabits;
    });
  };

  const updateHabitProgress = (id: string, date: string, increment: number) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    setHabits(prev => {
      const nextHabits = prev.map(h => {
        if (h.id === id) {
          const progress = { ...(h.progress || {}) };
          const current = progress[date] || 0;
          
          const isTimely = h.durationGoal !== undefined ? h.durationGoal > 0 : h.goalType === 'duration';
          const durationGoal = h.durationGoal || (h.goalType === 'duration' ? (h.durationUnit === 'hr' ? (h.goalValue || 0) * 3600 : h.durationUnit === 'min' ? (h.goalValue || 0) * 60 : (h.goalValue || 0)) : 0);
          const isDaily = h.dailyCompletions !== undefined ? h.dailyCompletions > 0 : (h.goalType === 'daily' || h.goalType === 'weekly');
          const dailyCompletions = h.dailyCompletions || ((h.goalType === 'daily' || h.goalType === 'weekly') ? h.goalValue || 1 : 1);
          
          let targetValue = 1;
          if (isTimely) {
            targetValue = durationGoal * (isDaily ? dailyCompletions : 1);
          } else if (isDaily) {
            targetValue = dailyCompletions;
          }

          let next = Math.max(0, current + increment);
          if (isDaily && !isTimely) {
            next = Math.min(next, targetValue);
          }
          progress[date] = next;
          
          const completedAt = { ...(h.completedAt || {}) };
          const uncompletedAt = { ...(h.uncompletedAt || {}) };

          // sync legacy dates array for basic presence checks
          let dates = [...(h.dates || [])];
          if (next >= targetValue && !dates.includes(date)) {
            dates.push(date);
            completedAt[date] = now;
          } else if (next < targetValue && dates.includes(date)) {
            dates = dates.filter(d => d !== date);
            uncompletedAt[date] = now;
          }
          
          return {
            ...h,
            progress,
            dates,
            completedAt,
            uncompletedAt,
            updatedAt: now
          };
        }
        return h;
      });

      habitsRef.current = nextHabits;
      const key = getStorageKey('habitflow_habits', userRef.current);
      localStorage.setItem(key, JSON.stringify(nextHabits));

      if (userRef.current && userRef.current.id) {
        flushSaveToFirestore(nextHabits);
      }

      return nextHabits;
    });
  };

  const addJournalEntry = (data: Omit<JournalEntry, 'id'>) => {
    lastLocalEditTime.current = Date.now();
    const entry: JournalEntry = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    setJournal(prev => [...prev, entry]);
  };

  const updateJournalEntry = (id: string, content: string) => {
    lastLocalEditTime.current = Date.now();
    setJournal(prev => prev.map(j => j.id === id ? { ...j, content } : j));
  };

  const deleteJournalEntry = (id: string) => {
    lastLocalEditTime.current = Date.now();
    setJournal(prev => prev.filter(j => j.id !== id));
  };

  return (
    <AppContext.Provider value={{
      habits, journal, journalSettings, appSettings, currentPage, setCurrentPage, activeHabitId, setActiveHabitId, user, setUser: setUserAndBackup,
      createAccount, signInAccount, signOutAccount, syncNow, syncStatus, lastSyncedAt,
      updateJournalSettings, updateAppSettings,
      addHabit, updateHabit, deleteHabit, reorderHabits, toggleHabitDate, updateHabitProgress,
      addJournalEntry, updateJournalEntry, deleteJournalEntry,
      darkMode, toggleDarkMode, setServerTimer, clearServerTimer
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
