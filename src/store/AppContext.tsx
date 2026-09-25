import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Habit, JournalEntry, Page, JournalSettings } from '../types';
import { formatDate, calculateStreak } from '../lib/utils';
import { mergeHabits, mergeJournal, sanitizeForFirestore } from '../lib/syncUtils';

const getInitialDeleted = (prefix: string, uid?: string | null): Set<string> => {
  try {
    if (uid) {
      const saved = localStorage.getItem(`${prefix}_${uid}`);
      return new Set<string>(saved ? JSON.parse(saved) : []);
    }
  } catch (e) {}
  return new Set<string>();
};

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
  const isInitialSyncDoneRef = useRef<boolean>(false);

  const deletedHabitsRef = useRef<Set<string>>(getInitialDeleted('habitflow_deleted_habits', user?.id));
  const deletedJournalRef = useRef<Set<string>>(getInitialDeleted('habitflow_deleted_journal', user?.id));

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

  // Track the last successfully synced state to prevent write-loops or premature overwrites
  const lastSyncedState = useRef({
    habits: JSON.stringify(habits),
    journal: JSON.stringify(journal),
    journalSettings: JSON.stringify(journalSettings),
    appSettings: JSON.stringify(appSettings)
  });

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

  // Keep Firebase Auth state verified across browser sessions
  useEffect(() => {
    let isSubscribed = true;
    const initAuth = async () => {
      try {
        const { auth } = await import('../lib/firebase');
        const { onAuthStateChanged } = await import('firebase/auth');
        const unsub = onAuthStateChanged(auth, (firebaseUser) => {
          if (!isSubscribed) return;
          if (firebaseUser) {
            const savedUserStr = localStorage.getItem('habitflow_current_user');
            if (savedUserStr) {
              const savedUser = JSON.parse(savedUserStr);
              if (savedUser.id !== firebaseUser.uid) {
                savedUser.id = firebaseUser.uid;
                localStorage.setItem('habitflow_current_user', JSON.stringify(savedUser));
                setUser(savedUser);
              }
            }
          }
        });
        return unsub;
      } catch (e) {
        console.warn("Auth state observer error:", e);
      }
    };
    const unsubPromise = initAuth();
    return () => {
      isSubscribed = false;
      unsubPromise.then(unsub => { if (unsub) unsub(); });
    };
  }, []);

  // 2. Debounced save to Firebase when state changes (ONLY for authenticated cloud accounts after initial sync)
  useEffect(() => {
    if (!user || !user.id || isLoggingOutRef.current || isSwitchingAccountRef.current) return;
    // CRITICAL: NEVER push to Firebase before initial load & reconciliation is complete!
    if (!isInitialSyncDoneRef.current) return;

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
      if (isLoggingOutRef.current || !currentUserId || isSwitchingAccountRef.current) return;
      try {
        const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');

        lastSyncedState.current = {
          habits: habitsStr,
          journal: journalStr,
          journalSettings: journalSettingsStr,
          appSettings: appSettingsStr,
        };

        const cleanData = sanitizeForFirestore({
          habits: JSON.parse(habitsStr),
          journal: JSON.parse(journalStr),
          journalSettings: JSON.parse(journalSettingsStr),
          appSettings: JSON.parse(appSettingsStr),
          deletedHabitIds: Array.from(deletedHabitsRef.current),
          deletedJournalIds: Array.from(deletedJournalRef.current),
          lastUpdated: Date.now()
        });

        const docPath = `users/${currentUserId}`;
        try {
          await setDoc(doc(db, 'users', currentUserId), cleanData, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, docPath);
        }
      } catch (error) {
        console.error("Failed to save to Firebase:", error);
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [habits, journal, journalSettings, appSettings, user]);

  // 3. Realtime Cross-Device Sync and initial reconciliation on user switch / mount
  useEffect(() => {
    if (isLoggingOutRef.current || isSwitchingAccountRef.current) return;

    if (unsubscribeFirebaseRef.current) {
      unsubscribeFirebaseRef.current();
      unsubscribeFirebaseRef.current = null;
    }

    if (user && user.id) {
      localStorage.setItem('habitflow_current_user', JSON.stringify(user));

      // Restore user-scoped storage keys
      const userHabitsKey = `habitflow_habits_${user.id}`;
      const userJournalKey = `habitflow_journal_${user.id}`;
      const userJSettingsKey = `habitflow_journal_settings_${user.id}`;
      const userASettingsKey = `habitflow_app_settings_${user.id}`;

      deletedHabitsRef.current = getInitialDeleted('habitflow_deleted_habits', user.id);
      deletedJournalRef.current = getInitialDeleted('habitflow_deleted_journal', user.id);

      const localHRaw = localStorage.getItem(userHabitsKey);
      const localJRaw = localStorage.getItem(userJournalKey);
      const localJSRaw = localStorage.getItem(userJSettingsKey);
      const localASRaw = localStorage.getItem(userASettingsKey);

      const initialLocalH: Habit[] = localHRaw ? JSON.parse(localHRaw) : [];
      const initialLocalJ: JournalEntry[] = localJRaw ? JSON.parse(localJRaw) : [];
      const initialLocalJS: Record<string, JournalSettings> = localJSRaw ? JSON.parse(localJSRaw) : {};
      const initialLocalAS: JournalSettings = localASRaw ? JSON.parse(localASRaw) : {};

      if (localHRaw) setHabits(initialLocalH);
      if (localJRaw) setJournal(initialLocalJ);
      if (localJSRaw) setJournalSettings(initialLocalJS);
      if (localASRaw) setAppSettings(initialLocalAS);

      lastSyncedState.current = {
        habits: JSON.stringify(initialLocalH),
        journal: JSON.stringify(initialLocalJ),
        journalSettings: JSON.stringify(initialLocalJS),
        appSettings: JSON.stringify(initialLocalAS)
      };

      let isFirstSnapshot = true;

      const loadFirebaseData = async () => {
        try {
          const { db, handleFirestoreError, OperationType } = await import('../lib/firebase');
          const { doc, onSnapshot, setDoc } = await import('firebase/firestore');

          const userDocRef = doc(db, 'users', user.id);

          const unsub = onSnapshot(
            userDocRef,
            async (userDoc) => {
              if (userDoc.metadata.hasPendingWrites) {
                return; // ignore optimistic writes currently in flight
              }

              if (userDoc.exists()) {
                const data = userDoc.data();
                const remoteHabits: Habit[] = Array.isArray(data.habits) ? data.habits : [];
                const remoteJournal: JournalEntry[] = Array.isArray(data.journal) ? data.journal : [];
                const remoteJS: Record<string, JournalSettings> = data.journalSettings || {};
                const remoteAS: JournalSettings = data.appSettings || {};
                const remoteDeletedHabits: string[] = Array.isArray(data.deletedHabitIds) ? data.deletedHabitIds : [];
                const remoteDeletedJournal: string[] = Array.isArray(data.deletedJournalIds) ? data.deletedJournalIds : [];

                for (const id of remoteDeletedHabits) deletedHabitsRef.current.add(id);
                for (const id of remoteDeletedJournal) deletedJournalRef.current.add(id);
                localStorage.setItem(`habitflow_deleted_habits_${user.id}`, JSON.stringify(Array.from(deletedHabitsRef.current)));
                localStorage.setItem(`habitflow_deleted_journal_${user.id}`, JSON.stringify(Array.from(deletedJournalRef.current)));

                const activeDeletedHabits = Array.from(deletedHabitsRef.current);
                const activeDeletedJournal = Array.from(deletedJournalRef.current);

                // Smart non-destructive merge: completions from both devices are unioned!
                setHabits(currentHabits => {
                  const merged = mergeHabits(currentHabits, remoteHabits, activeDeletedHabits);
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.habits = str;
                  localStorage.setItem(userHabitsKey, str);
                  return merged;
                });

                setJournal(currentJournal => {
                  const merged = mergeJournal(currentJournal, remoteJournal, activeDeletedJournal);
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.journal = str;
                  localStorage.setItem(userJournalKey, str);
                  return merged;
                });

                setJournalSettings(currentJS => {
                  const merged = { ...remoteJS, ...currentJS };
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.journalSettings = str;
                  localStorage.setItem(userJSettingsKey, str);
                  return merged;
                });

                setAppSettings(currentAS => {
                  const merged = { ...remoteAS, ...currentAS };
                  const str = JSON.stringify(merged);
                  lastSyncedState.current.appSettings = str;
                  localStorage.setItem(userASettingsKey, str);
                  return merged;
                });

                if (isFirstSnapshot) {
                  isFirstSnapshot = false;
                  isInitialSyncDoneRef.current = true;

                  // Reconcile: If local device had un-synced completions or habits not yet on the server, push the union
                  const reconciledHabits = mergeHabits(initialLocalH, remoteHabits, activeDeletedHabits);
                  const reconciledJournal = mergeJournal(initialLocalJ, remoteJournal, activeDeletedJournal);
                  const reconciledJS = { ...remoteJS, ...initialLocalJS };
                  const reconciledAS = { ...remoteAS, ...initialLocalAS };

                  const habitsNeedPush = JSON.stringify(reconciledHabits) !== JSON.stringify(remoteHabits);
                  const journalNeedsPush = JSON.stringify(reconciledJournal) !== JSON.stringify(remoteJournal);
                  const jsNeedsPush = JSON.stringify(reconciledJS) !== JSON.stringify(remoteJS);
                  const asNeedsPush = JSON.stringify(reconciledAS) !== JSON.stringify(remoteAS);

                  if (habitsNeedPush || journalNeedsPush || jsNeedsPush || asNeedsPush) {
                    const cleanReconciled = sanitizeForFirestore({
                      habits: reconciledHabits,
                      journal: reconciledJournal,
                      journalSettings: reconciledJS,
                      appSettings: reconciledAS,
                      deletedHabitIds: activeDeletedHabits,
                      deletedJournalIds: activeDeletedJournal,
                      lastUpdated: Date.now()
                    });
                    try {
                      await setDoc(userDocRef, cleanReconciled, { merge: true });
                    } catch (err) {
                      console.warn("Reconcile push warning:", err);
                    }
                  }
                }
              } else {
                if (isFirstSnapshot) {
                  isFirstSnapshot = false;
                  isInitialSyncDoneRef.current = true;
                  if (initialLocalH.length > 0 || initialLocalJ.length > 0) {
                    const initialDoc = sanitizeForFirestore({
                      habits: initialLocalH,
                      journal: initialLocalJ,
                      journalSettings: initialLocalJS,
                      appSettings: initialLocalAS,
                      deletedHabitIds: Array.from(deletedHabitsRef.current),
                      deletedJournalIds: Array.from(deletedJournalRef.current),
                      lastUpdated: Date.now()
                    });
                    try {
                      await setDoc(userDocRef, initialDoc, { merge: true });
                    } catch (err) {
                      console.warn("Initial push to fresh doc warning:", err);
                    }
                  }
                }
              }
            },
            (error) => {
              handleFirestoreError(error, OperationType.GET, `users/${user.id}`);
            }
          );
          unsubscribeFirebaseRef.current = unsub;
        } catch (error) {
          console.error("Failed to load Firebase data:", error);
          isInitialSyncDoneRef.current = true; // allow local usage even if offline
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
      isInitialSyncDoneRef.current = true;
    }

    return () => {
      if (unsubscribeFirebaseRef.current) {
        unsubscribeFirebaseRef.current();
        unsubscribeFirebaseRef.current = null;
      }
    };
  }, [user]);

  // When a user "creates an account", sync all locally saved content to his account,
  // and save further changes in his account - not to local.
  const createAccount = async (username: string, displayName: string, photoURL: string, pwd: string) => {
    isSwitchingAccountRef.current = true;
    try {
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const { auth, db, handleFirestoreError, OperationType } = await import('../lib/firebase');
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

      const now = Date.now();
      const initialHabits: Habit[] = (localH ? JSON.parse(localH) : habits).map((h: Habit) => ({
        ...h,
        updatedAt: h.updatedAt || now
      }));
      const initialJournal: JournalEntry[] = (localJ ? JSON.parse(localJ) : journal).map((j: JournalEntry) => ({
        ...j,
        updatedAt: j.updatedAt || j.createdAt || now
      }));
      const initialJS: Record<string, JournalSettings> = localJS ? JSON.parse(localJS) : journalSettings;
      const initialAS: JournalSettings = localAS ? JSON.parse(localAS) : appSettings;

      const newUserDoc = sanitizeForFirestore({
        id: uid,
        username,
        name: displayName,
        photoURL: photoURL || '',
        habits: initialHabits,
        journal: initialJournal,
        journalSettings: initialJS,
        appSettings: initialAS,
        deletedHabitIds: [],
        deletedJournalIds: [],
        createdAt: now,
        lastUpdated: now
      });

      await setDoc(doc(db, 'usernames', username.toLowerCase()), { uid });
      await setDoc(doc(db, 'users', uid), newUserDoc);

      // Save to this user's isolated local cache
      localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(initialHabits));
      localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(initialJournal));
      localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(initialJS));
      localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(initialAS));

      deletedHabitsRef.current = new Set();
      deletedJournalRef.current = new Set();
      localStorage.setItem(`habitflow_deleted_habits_${uid}`, '[]');
      localStorage.setItem(`habitflow_deleted_journal_${uid}`, '[]');

      const userInfo = {
        id: uid,
        username,
        name: displayName,
        photoURL: photoURL || ''
      };
      localStorage.setItem('habitflow_current_user', JSON.stringify(userInfo));

      lastSyncedState.current = {
        habits: JSON.stringify(initialHabits),
        journal: JSON.stringify(initialJournal),
        journalSettings: JSON.stringify(initialJS),
        appSettings: JSON.stringify(initialAS)
      };

      isInitialSyncDoneRef.current = true;

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

  // When the user "signs in" from any device:
  // Robustly fetch and reconcile cloud account data, preserving all existing completions and habits!
  const signInAccount = async (username: string, pwd: string) => {
    isSwitchingAccountRef.current = true;
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth, db, handleFirestoreError, OperationType } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');

      const email = `${username.toLowerCase()}@habitflow.local`;
      const userCredential = await signInWithEmailAndPassword(auth, email, pwd);
      const uid = userCredential.user.uid;

      let userDoc;
      try {
        userDoc = await getDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        return;
      }

      if (!userDoc || !userDoc.exists()) {
        throw new Error("Account data not found.");
      }

      const data = userDoc.data();
      const cloudHabits: Habit[] = Array.isArray(data.habits) ? data.habits : [];
      const cloudJournal: JournalEntry[] = Array.isArray(data.journal) ? data.journal : [];
      const cloudJS: Record<string, JournalSettings> = data.journalSettings || {};
      const cloudAS: JournalSettings = data.appSettings || {};
      const cloudDeletedHabits: string[] = Array.isArray(data.deletedHabitIds) ? data.deletedHabitIds : [];
      const cloudDeletedJournal: string[] = Array.isArray(data.deletedJournalIds) ? data.deletedJournalIds : [];

      // Check if this device already had previous local cache for this user
      const cachedHRaw = localStorage.getItem(`habitflow_habits_${uid}`);
      const cachedH: Habit[] = cachedHRaw ? JSON.parse(cachedHRaw) : [];
      const cachedJRaw = localStorage.getItem(`habitflow_journal_${uid}`);
      const cachedJ: JournalEntry[] = cachedJRaw ? JSON.parse(cachedJRaw) : [];
      const cachedJSRaw = localStorage.getItem(`habitflow_journal_settings_${uid}`);
      const cachedJS = cachedJSRaw ? JSON.parse(cachedJSRaw) : {};
      const cachedASRaw = localStorage.getItem(`habitflow_app_settings_${uid}`);
      const cachedAS = cachedASRaw ? JSON.parse(cachedASRaw) : {};

      // Setup deleted sets
      deletedHabitsRef.current = new Set(cloudDeletedHabits);
      deletedJournalRef.current = new Set(cloudDeletedJournal);
      localStorage.setItem(`habitflow_deleted_habits_${uid}`, JSON.stringify(cloudDeletedHabits));
      localStorage.setItem(`habitflow_deleted_journal_${uid}`, JSON.stringify(cloudDeletedJournal));

      // Merge cached data with cloud data: cloud is primary, but un-synced completions are preserved
      const resolvedHabits = mergeHabits(cachedH, cloudHabits, cloudDeletedHabits);
      const resolvedJournal = mergeJournal(cachedJ, cloudJournal, cloudDeletedJournal);
      const resolvedJS = { ...cloudJS, ...cachedJS };
      const resolvedAS = { ...cloudAS, ...cachedAS };

      // Write to user's isolated storage
      localStorage.setItem(`habitflow_habits_${uid}`, JSON.stringify(resolvedHabits));
      localStorage.setItem(`habitflow_journal_${uid}`, JSON.stringify(resolvedJournal));
      localStorage.setItem(`habitflow_journal_settings_${uid}`, JSON.stringify(resolvedJS));
      localStorage.setItem(`habitflow_app_settings_${uid}`, JSON.stringify(resolvedAS));

      const userInfo = {
        id: uid,
        username: data.username || username,
        name: data.name || username,
        photoURL: data.photoURL || ''
      };
      localStorage.setItem('habitflow_current_user', JSON.stringify(userInfo));

      lastSyncedState.current = {
        habits: JSON.stringify(resolvedHabits),
        journal: JSON.stringify(resolvedJournal),
        journalSettings: JSON.stringify(resolvedJS),
        appSettings: JSON.stringify(resolvedAS)
      };

      isInitialSyncDoneRef.current = true;

      setHabits(resolvedHabits);
      setJournal(resolvedJournal);
      setJournalSettings(resolvedJS);
      setAppSettings(resolvedAS);
      setUser(userInfo);

      // If resolving merged habits resulted in local completions not yet on cloud, push update
      if (JSON.stringify(resolvedHabits) !== JSON.stringify(cloudHabits) ||
          JSON.stringify(resolvedJournal) !== JSON.stringify(cloudJournal)) {
        try {
          await setDoc(doc(db, 'users', uid), sanitizeForFirestore({
            habits: resolvedHabits,
            journal: resolvedJournal,
            journalSettings: resolvedJS,
            appSettings: resolvedAS,
            deletedHabitIds: cloudDeletedHabits,
            deletedJournalIds: cloudDeletedJournal,
            lastUpdated: Date.now()
          }), { merge: true });
        } catch (e) {
          console.warn("Sign-in sync push warning:", e);
        }
      }
    } finally {
      setTimeout(() => {
        isSwitchingAccountRef.current = false;
      }, 200);
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

    deletedHabitsRef.current = new Set();
    deletedJournalRef.current = new Set();
    isInitialSyncDoneRef.current = false;

    // 5. Sign out of Firebase Auth
    try {
      const { auth } = await import('../lib/firebase');
      await auth.signOut();
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }

    // 6. Restore the dedicated local account (clean, independent from cloud account)
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
    lastLocalEditTime.current = Date.now();
    const todayStr = formatDate(new Date());
    const now = Date.now();
    const newHabit: Habit = {
      ...habitData,
      id: crypto.randomUUID(),
      created: todayStr,
      dates: [],
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
    lastLocalEditTime.current = Date.now();
    const now = Date.now();
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates, updatedAt: now } : h));
  };

  const deleteHabit = (id: string) => {
    lastLocalEditTime.current = Date.now();
    deletedHabitsRef.current.add(id);
    if (user && user.id) {
      localStorage.setItem(`habitflow_deleted_habits_${user.id}`, JSON.stringify(Array.from(deletedHabitsRef.current)));
    }
    setHabits(prev => prev.filter(h => h.id !== id));
    setJournal(prev => prev.filter(j => j.habitId !== id));
    if (activeHabitId === id) setActiveHabitId(null);
  };

  const reorderHabits = (newHabits: Habit[]) => {
    lastLocalEditTime.current = Date.now();
    setHabits(newHabits);
  };

  const toggleHabitDate = (id: string, date: string) => {
    lastLocalEditTime.current = Date.now();
    const now = Date.now();
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const dates = h.dates.includes(date)
          ? h.dates.filter(d => d !== date)
          : [...h.dates, date];
        
        // Also sync with progress object
        const progress = { ...(h.progress || {}) };
        if (dates.includes(date)) {
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
        
        return { ...h, dates, progress, updatedAt: now };
      }
      return h;
    }));
  };

  const updateHabitProgress = (id: string, date: string, increment: number) => {
    lastLocalEditTime.current = Date.now();
    const now = Date.now();
    setHabits(prev => prev.map(h => {
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
        
        // sync legacy dates array for basic presence checks
        let dates = [...h.dates];
        if (next >= targetValue && !dates.includes(date)) {
          dates.push(date);
        } else if (next < targetValue && dates.includes(date)) {
          dates = dates.filter(d => d !== date);
        }
        
        return { ...h, progress, dates, updatedAt: now };
      }
      return h;
    }));
  };

  const addJournalEntry = (data: Omit<JournalEntry, 'id'>) => {
    lastLocalEditTime.current = Date.now();
    const now = Date.now();
    const entry: JournalEntry = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
    setJournal(prev => [...prev, entry]);
  };

  const updateJournalEntry = (id: string, content: string) => {
    lastLocalEditTime.current = Date.now();
    const now = Date.now();
    setJournal(prev => prev.map(j => j.id === id ? { ...j, content, updatedAt: now } : j));
  };

  const deleteJournalEntry = (id: string) => {
    lastLocalEditTime.current = Date.now();
    deletedJournalRef.current.add(id);
    if (user && user.id) {
      localStorage.setItem(`habitflow_deleted_journal_${user.id}`, JSON.stringify(Array.from(deletedJournalRef.current)));
    }
    setJournal(prev => prev.filter(j => j.id !== id));
  };

  return (
    <AppContext.Provider value={{
      habits, journal, journalSettings, appSettings, currentPage, setCurrentPage, activeHabitId, setActiveHabitId, user, setUser: setUserAndBackup,
      createAccount, signInAccount, signOutAccount,
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
