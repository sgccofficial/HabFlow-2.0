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
  const isSnapshotActiveRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<any>(null);
  const activeListeningUserIdRef = useRef<string | null>(null);

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

  // Dedicated immediate flush function for saving to Firestore without dropping writes when backgrounded or offline
  const hasPendingOfflineWrites = useRef<boolean>(
    typeof window !== 'undefined' && localStorage.getItem('habitflow_pending_offline_sync') === 'true'
  );

  const flushSaveToFirestore = async (
    targetHabits = habitsRef.current,
    targetJournal = journalRef.current,
    targetJS = journalSettingsRef.current,
    targetAS = appSettingsRef.current
  ) => {
    const targetUser = userRef.current;
    if (!targetUser || !targetUser.id || isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    
    // Safety guard: do not flush if initial remote sync hasn't completed and no user action occurred
    if (!hasInitialRemoteSyncHappened.current && lastLocalEditTime.current === 0) {
      return;
    }

    // Safety guard: never overwrite cloud data with empty habits unless user explicitly cleared them
    if (targetHabits.length === 0 && lastLocalEditTime.current === 0) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const habitsStr = JSON.stringify(targetHabits);
    const journalStr = JSON.stringify(targetJournal);
    const jsStr = JSON.stringify(targetJS);
    const asStr = JSON.stringify(targetAS);

    // Save immediately to local persistent storage
    localStorage.setItem(getStorageKey('habitflow_habits', targetUser), habitsStr);
    localStorage.setItem(getStorageKey('habitflow_journal', targetUser), journalStr);
    localStorage.setItem(getStorageKey('habitflow_journal_settings', targetUser), jsStr);
    localStorage.setItem(getStorageKey('habitflow_app_settings', targetUser), asStr);

    try {
      const { db } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

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
      lastLocalEditTime.current = 0;
      hasPendingOfflineWrites.current = false;
      localStorage.removeItem('habitflow_pending_offline_sync');
      setSyncStatus('synced');
      setLastSyncedAt(now);
      localStorage.setItem('habitflow_last_synced_at', String(now));
    } catch (err) {
      console.warn("Silent save to Firestore warning (stored offline):", err);
      hasPendingOfflineWrites.current = true;
      localStorage.setItem('habitflow_pending_offline_sync', 'true');
      setSyncStatus('idle');
    }
  };

  // Immediate flush on page hide/unload/visibility change to prevent lost data on mobile sleep/close
  useEffect(() => {
    const handleFlush = () => {
      if (userRef.current && userRef.current.id && hasInitialRemoteSyncHappened.current && lastLocalEditTime.current > 0) {
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
          if (firebaseUser) {
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

                const cloudHabits: Habit[] = Array.isArray(uData.habits) ? uData.habits : [];
                const cloudJournal: JournalEntry[] = Array.isArray(uData.journal) ? uData.journal : [];
                const cloudJS: Record<string, JournalSettings> = uData.journalSettings || {};
                const cloudAS: JournalSettings = uData.appSettings || {};

                const uid = firebaseUser.uid;
                localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(cloudHabits));
                localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(cloudJournal));
                localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(cloudJS));
                localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(cloudAS));
                localStorage.setItem('habitflow_current_user', JSON.stringify(restoredUser));

                habitsRef.current = cloudHabits;
                journalRef.current = cloudJournal;
                journalSettingsRef.current = cloudJS;
                appSettingsRef.current = cloudAS;
                lastSyncedState.current = {
                  habits: JSON.stringify(cloudHabits),
                  journal: JSON.stringify(cloudJournal),
                  journalSettings: JSON.stringify(cloudJS),
                  appSettings: JSON.stringify(cloudAS)
                };
                hasInitialRemoteSyncHappened.current = true;
                hasPendingOfflineWrites.current = false;
                localStorage.removeItem('habitflow_pending_offline_sync');

                setHabits(cloudHabits);
                setJournal(cloudJournal);
                setJournalSettings(cloudJS);
                setAppSettings(cloudAS);
                setUser(restoredUser);
                setSyncStatus('synced');
                const now = Date.now();
                setLastSyncedAt(now);
                localStorage.setItem('habitflow_last_synced_at', String(now));
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

    // Guard: Only save to Firebase if initial remote sync has occurred AND an explicit local user edit occurred.
    // Incoming updates from other devices must never be echoed back to Firebase.
    if (!hasInitialRemoteSyncHappened.current || lastLocalEditTime.current === 0) {
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
        lastLocalEditTime.current = 0;
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

  // Stop real-time Firestore listener
  const stopRealtimeListener = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (unsubscribeFirebaseRef.current) {
      try {
        unsubscribeFirebaseRef.current();
      } catch (e) {}
      unsubscribeFirebaseRef.current = null;
    }
    isSnapshotActiveRef.current = false;
    activeListeningUserIdRef.current = null;
  };

  // Start real-time Firestore listener with automatic reconnection and multi-device propagation
  const startRealtimeListener = (targetUserId: string) => {
    if (!targetUserId || isLoggingOutRef.current || isSwitchingAccountRef.current) return;

    // If already actively listening to this exact user ID, skip duplicate registration
    if (isSnapshotActiveRef.current && activeListeningUserIdRef.current === targetUserId && unsubscribeFirebaseRef.current) {
      return;
    }

    stopRealtimeListener();
    activeListeningUserIdRef.current = targetUserId;

    import('../lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        if (!userRef.current || userRef.current.id !== targetUserId || isLoggingOutRef.current) {
          stopRealtimeListener();
          return;
        }

        const userDocRef = doc(db, 'users', targetUserId);
        const userHabitsKey = `habitflow_habits_${targetUserId}`;
        const userJournalKey = `habitflow_journal_${targetUserId}`;
        const userJSettingsKey = `habitflow_journal_settings_${targetUserId}`;
        const userASettingsKey = `habitflow_app_settings_${targetUserId}`;

        try {
          const unsub = onSnapshot(
            userDocRef,
            (userDoc) => {
              isSnapshotActiveRef.current = true;
              if (userDoc.exists()) {
                const data = userDoc.data();

                if (data.habits && Array.isArray(data.habits)) {
                  const cloudHabits: Habit[] = data.habits;
                  const isPending = hasPendingOfflineWrites.current || localStorage.getItem('habitflow_pending_offline_sync') === 'true';
                  let nextHabits = cloudHabits;
                  if (isPending && habitsRef.current.length > 0) {
                    nextHabits = mergeHabitLists(habitsRef.current, cloudHabits);
                  }
                  const str = JSON.stringify(nextHabits);
                  if (str !== JSON.stringify(habitsRef.current)) {
                    habitsRef.current = nextHabits;
                    lastSyncedState.current.habits = str;
                    localStorage.setItem(userHabitsKey, str);
                    setHabits(nextHabits);
                  }
                }

                if (data.journal && Array.isArray(data.journal)) {
                  const cloudJournal = data.journal;
                  const isPending = hasPendingOfflineWrites.current || localStorage.getItem('habitflow_pending_offline_sync') === 'true';
                  let nextJournal = cloudJournal;
                  if (isPending && journalRef.current.length > 0) {
                    nextJournal = mergeJournalLists(journalRef.current, cloudJournal);
                  }
                  const str = JSON.stringify(nextJournal);
                  if (str !== JSON.stringify(journalRef.current)) {
                    journalRef.current = nextJournal;
                    lastSyncedState.current.journal = str;
                    localStorage.setItem(userJournalKey, str);
                    setJournal(nextJournal);
                  }
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
              isSnapshotActiveRef.current = false;
              setSyncStatus('error');
              // Auto-reconnect after dropped connection or wake
              if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = setTimeout(() => {
                if (userRef.current && userRef.current.id === targetUserId && !isLoggingOutRef.current) {
                  startRealtimeListener(targetUserId);
                }
              }, 3000);
            }
          );

          unsubscribeFirebaseRef.current = unsub;
        } catch (err) {
          console.warn("Error attaching snapshot listener:", err);
          isSnapshotActiveRef.current = false;
        }
      });
    });
  };

  // Silent automatic sync function (no UI prompts or clutter)
  const syncNow = async () => {
    const targetUser = userRef.current;
    if (!targetUser || !targetUser.id || isLoggingOutRef.current) return;
    try {
      const { db } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', targetUser.id);

      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const remoteData = snap.data();
        const cloudHabits: Habit[] = Array.isArray(remoteData.habits) ? remoteData.habits : [];
        const cloudJournal: JournalEntry[] = Array.isArray(remoteData.journal) ? remoteData.journal : [];

        let finalHabits = cloudHabits;
        let finalJournal = cloudJournal;

        const isPending = hasPendingOfflineWrites.current || localStorage.getItem('habitflow_pending_offline_sync') === 'true';
        if (isPending && habitsRef.current.length > 0) {
          finalHabits = mergeHabitLists(habitsRef.current, cloudHabits);
          finalJournal = mergeJournalLists(journalRef.current, cloudJournal);

          const cleanData: any = {
            habits: finalHabits,
            journal: finalJournal,
            journalSettings: { ...(remoteData.journalSettings || {}), ...journalSettingsRef.current },
            appSettings: { ...(remoteData.appSettings || {}), ...appSettingsRef.current },
            lastUpdated: Date.now()
          };
          await setDoc(userDocRef, cleanData, { merge: true });
          hasPendingOfflineWrites.current = false;
          localStorage.removeItem('habitflow_pending_offline_sync');
        } else {
          hasPendingOfflineWrites.current = false;
          localStorage.removeItem('habitflow_pending_offline_sync');
        }

        const habitsStr = JSON.stringify(finalHabits);
        if (habitsStr !== JSON.stringify(habitsRef.current)) {
          habitsRef.current = finalHabits;
          lastSyncedState.current.habits = habitsStr;
          localStorage.setItem(getStorageKey('habitflow_habits', targetUser), habitsStr);
          setHabits(finalHabits);
        }

        const journalStr = JSON.stringify(finalJournal);
        if (journalStr !== JSON.stringify(journalRef.current)) {
          journalRef.current = finalJournal;
          lastSyncedState.current.journal = journalStr;
          localStorage.setItem(getStorageKey('habitflow_journal', targetUser), journalStr);
          setJournal(finalJournal);
        }

        if (remoteData.journalSettings) {
          const currentJS = { ...journalSettingsRef.current, ...remoteData.journalSettings };
          const str = JSON.stringify(currentJS);
          if (str !== lastSyncedState.current.journalSettings) {
            setJournalSettings(currentJS);
            journalSettingsRef.current = currentJS;
            localStorage.setItem(getStorageKey('habitflow_journal_settings', targetUser), str);
            lastSyncedState.current.journalSettings = str;
          }
        }
        if (remoteData.appSettings) {
          const currentAS = { ...appSettingsRef.current, ...remoteData.appSettings };
          const str = JSON.stringify(currentAS);
          if (str !== lastSyncedState.current.appSettings) {
            setAppSettings(currentAS);
            appSettingsRef.current = currentAS;
            localStorage.setItem(getStorageKey('habitflow_app_settings', targetUser), str);
            lastSyncedState.current.appSettings = str;
          }
        }

        const now = Date.now();
        setSyncStatus('synced');
        setLastSyncedAt(now);
      }
    } catch (e) {
      console.warn("Silent sync attempt:", e);
    }
  };

  // 3. Multi-device sync and load on user switch / mount
  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;

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

      if (localH) {
        try {
          const parsed = JSON.parse(localH);
          habitsRef.current = parsed;
          setHabits(parsed);
        } catch (e) {}
      }
      if (localJ) {
        try {
          const parsed = JSON.parse(localJ);
          journalRef.current = parsed;
          setJournal(parsed);
        } catch (e) {}
      }
      if (localJS) {
        try {
          const parsed = JSON.parse(localJS);
          journalSettingsRef.current = parsed;
          setJournalSettings(parsed);
        } catch (e) {}
      }
      if (localAS) {
        try {
          const parsed = JSON.parse(localAS);
          appSettingsRef.current = parsed;
          setAppSettings(parsed);
        } catch (e) {}
      }

      // Initial fast remote fetch & startup sync
      const initLoad = async () => {
        try {
          setSyncStatus('syncing');
          await syncNow();
        } catch (err) {
          console.warn("Init sync warning:", err);
        } finally {
          hasInitialRemoteSyncHappened.current = true;
          // Start the live real-time bidirectional listener
          startRealtimeListener(user.id);
        }
      };

      initLoad();

      // Silent automatic sync when returning to tab/app or coming online
      const handleSilentSync = () => {
        if (document.visibilityState === 'visible' || navigator.onLine) {
          syncNow();
          if (!isSnapshotActiveRef.current) {
            startRealtimeListener(user.id);
          }
        }
      };

      document.addEventListener('visibilitychange', handleSilentSync);
      window.addEventListener('focus', handleSilentSync);
      window.addEventListener('online', handleSilentSync);

      // Periodic heartbeat every 15s to keep real-time sync alive across mobile backgrounding/sleep
      const heartbeat = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          syncNow();
          if (!isSnapshotActiveRef.current) {
            startRealtimeListener(user.id);
          }
        }
      }, 15000);

      return () => {
        document.removeEventListener('visibilitychange', handleSilentSync);
        window.removeEventListener('focus', handleSilentSync);
        window.removeEventListener('online', handleSilentSync);
        clearInterval(heartbeat);
        stopRealtimeListener();
      };
    } else {
      stopRealtimeListener();
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
  }, [user?.id]);

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

  // When the user signs in from any device, load the account's cloud data directly
  const signInAccount = async (username: string, pwd: string) => {
    isSwitchingAccountRef.current = true;
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth, db } = await import('../lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');

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

      // Write directly to user's storage keys
      localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(cloudHabits));
      localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(cloudJournal));
      localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(cloudJS));
      localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(cloudAS));

      const userInfo = {
        id: uid,
        username: data.username || username,
        name: data.name || username,
        photoURL: data.photoURL || ''
      };
      localStorage.setItem('habitflow_current_user', JSON.stringify(userInfo));

      habitsRef.current = cloudHabits;
      journalRef.current = cloudJournal;
      journalSettingsRef.current = cloudJS;
      appSettingsRef.current = cloudAS;

      lastSyncedState.current = {
        habits: JSON.stringify(cloudHabits),
        journal: JSON.stringify(cloudJournal),
        journalSettings: JSON.stringify(cloudJS),
        appSettings: JSON.stringify(cloudAS)
      };

      hasInitialRemoteSyncHappened.current = true;
      hasPendingOfflineWrites.current = false;
      localStorage.removeItem('habitflow_pending_offline_sync');
      lastLocalEditTime.current = 0;

      setHabits(cloudHabits);
      setJournal(cloudJournal);
      setJournalSettings(cloudJS);
      setAppSettings(cloudAS);
      setUser(userInfo);
      setSyncStatus('synced');
      const now = Date.now();
      setLastSyncedAt(now);
      localStorage.setItem('habitflow_last_synced_at', String(now));
    } catch (err) {
      throw err;
    } finally {
      setTimeout(() => {
        isSwitchingAccountRef.current = false;
      }, 300);
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
    setJournalSettings(prev => {
      const next = { ...prev, [habitId]: { ...prev[habitId], ...settings } };
      journalSettingsRef.current = next;
      const key = getStorageKey('habitflow_journal_settings', userRef.current);
      localStorage.setItem(key, JSON.stringify(next));
      if (userRef.current && userRef.current.id) {
        flushSaveToFirestore(undefined, undefined, next);
      }
      return next;
    });
  };

  useEffect(() => {
    if (swSubscription) {
      syncNotificationSettings(habits, swSubscription);
    }
  }, [habits, swSubscription]);

  const updateAppSettings = (settings: JournalSettings) => {
    lastLocalEditTime.current = Date.now();
    setAppSettings(prev => {
      const next = { ...prev, ...settings };
      appSettingsRef.current = next;
      const key = getStorageKey('habitflow_app_settings', userRef.current);
      localStorage.setItem(key, JSON.stringify(next));
      if (userRef.current && userRef.current.id) {
        flushSaveToFirestore(undefined, undefined, undefined, next);
      }
      return next;
    });
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
    const nextHabits = [...habitsRef.current, newHabit];
    habitsRef.current = nextHabits;
    const key = getStorageKey('habitflow_habits', userRef.current);
    localStorage.setItem(key, JSON.stringify(nextHabits));
    setHabits(nextHabits);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits);
    }
  };

  const updateHabit = (id: string, updates: Partial<Omit<Habit, 'id' | 'created'>>) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const nextHabits = habitsRef.current.map(h => h.id === id ? { ...h, ...updates, updatedAt: now } : h);
    habitsRef.current = nextHabits;
    const key = getStorageKey('habitflow_habits', userRef.current);
    localStorage.setItem(key, JSON.stringify(nextHabits));
    setHabits(nextHabits);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits);
    }
  };

  const deleteHabit = (id: string) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const nextHabits = habitsRef.current.filter(h => h.id !== id);
    habitsRef.current = nextHabits;
    const key = getStorageKey('habitflow_habits', userRef.current);
    localStorage.setItem(key, JSON.stringify(nextHabits));
    setHabits(nextHabits);

    const nextJournal = journalRef.current.filter(j => j.habitId !== id);
    journalRef.current = nextJournal;
    const jKey = getStorageKey('habitflow_journal', userRef.current);
    localStorage.setItem(jKey, JSON.stringify(nextJournal));
    setJournal(nextJournal);

    if (activeHabitId === id) setActiveHabitId(null);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits, nextJournal);
    }
  };

  const reorderHabits = (newHabits: Habit[]) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const nextHabits = newHabits.map(h => ({ ...h, updatedAt: now }));
    habitsRef.current = nextHabits;
    const key = getStorageKey('habitflow_habits', userRef.current);
    localStorage.setItem(key, JSON.stringify(nextHabits));
    setHabits(nextHabits);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits);
    }
  };

  const toggleHabitDate = (id: string, date: string) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const nextHabits = habitsRef.current.map(h => {
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
          
          progress[date] = targetValue;
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
    setHabits(nextHabits);

    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits);
    }
  };

  const updateHabitProgress = (id: string, date: string, increment: number) => {
    const now = Date.now();
    lastLocalEditTime.current = now;
    const nextHabits = habitsRef.current.map(h => {
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
    setHabits(nextHabits);

    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(nextHabits);
    }
  };

  const addJournalEntry = (data: Omit<JournalEntry, 'id'>) => {
    lastLocalEditTime.current = Date.now();
    const entry: JournalEntry = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };
    const next = [...journalRef.current, entry];
    journalRef.current = next;
    const key = getStorageKey('habitflow_journal', userRef.current);
    localStorage.setItem(key, JSON.stringify(next));
    setJournal(next);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(undefined, next);
    }
  };

  const updateJournalEntry = (id: string, content: string) => {
    lastLocalEditTime.current = Date.now();
    const next = journalRef.current.map(j => j.id === id ? { ...j, content } : j);
    journalRef.current = next;
    const key = getStorageKey('habitflow_journal', userRef.current);
    localStorage.setItem(key, JSON.stringify(next));
    setJournal(next);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(undefined, next);
    }
  };

  const deleteJournalEntry = (id: string) => {
    lastLocalEditTime.current = Date.now();
    const next = journalRef.current.filter(j => j.id !== id);
    journalRef.current = next;
    const key = getStorageKey('habitflow_journal', userRef.current);
    localStorage.setItem(key, JSON.stringify(next));
    setJournal(next);
    if (userRef.current && userRef.current.id) {
      flushSaveToFirestore(undefined, next);
    }
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
