import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Habit, JournalEntry, Page, JournalSettings } from '../types';
import { formatDate, calculateStreak } from '../lib/utils';

interface AppContextType {
  habits: Habit[];
  journal: JournalEntry[];
  journalSettings: Record<string, JournalSettings>;
  appSettings: JournalSettings;
  currentPage: Page;
  activeHabitId: string | null;
  user: any | null;
  setUser: (user: any | null) => void;
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
  const lastSyncedState = useRef({ habits: '', journal: '', journalSettings: '', appSettings: '' });
  const saveTimeoutRef = useRef<any>(null);
  const isLoggingOutRef = useRef<boolean>(false);
  const unsubscribeFirebaseRef = useRef<(() => void) | null>(null);

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

  // 1. Instant local persistence: save to localStorage on every change
  useEffect(() => {
    if (isLoggingOutRef.current) return;
    const key = getStorageKey('habitflow_habits');
    localStorage.setItem(key, JSON.stringify(habits));
    syncNotificationSettings(habits);
  }, [habits, user]);

  useEffect(() => {
    if (isLoggingOutRef.current) return;
    const key = getStorageKey('habitflow_journal');
    localStorage.setItem(key, JSON.stringify(journal));
  }, [journal, user]);

  useEffect(() => {
    if (isLoggingOutRef.current) return;
    const key = getStorageKey('habitflow_journal_settings');
    localStorage.setItem(key, JSON.stringify(journalSettings));
  }, [journalSettings, user]);

  useEffect(() => {
    if (isLoggingOutRef.current) return;
    const key = getStorageKey('habitflow_app_settings');
    localStorage.setItem(key, JSON.stringify(appSettings));
  }, [appSettings, user]);

  // 2. Debounced save to Firebase when state changes (ONLY for authenticated cloud accounts)
  useEffect(() => {
    if (!user || !user.id || isLoggingOutRef.current) return;

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
      if (isLoggingOutRef.current || !currentUserId) return;
      try {
        const { db } = await import('../lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');

        lastSyncedState.current = {
          habits: habitsStr,
          journal: journalStr,
          journalSettings: journalSettingsStr,
          appSettings: appSettingsStr,
        };

        const cleanData: any = {
          habits: JSON.parse(habitsStr),
          journal: JSON.parse(journalStr),
          journalSettings: JSON.parse(journalSettingsStr),
          appSettings: JSON.parse(appSettingsStr),
          lastUpdated: Date.now()
        };

        await setDoc(doc(db, 'users', currentUserId), cleanData, { merge: true });
      } catch (error) {
        console.error("Failed to save to Firebase:", error);
      }
    }, 300);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [habits, journal, journalSettings, appSettings, user]);

  // 3. Sync and load on user switch / mount
  useEffect(() => {
    if (isLoggingOutRef.current) return;

    if (unsubscribeFirebaseRef.current) {
      unsubscribeFirebaseRef.current();
      unsubscribeFirebaseRef.current = null;
    }

    if (user && user.id) {
      localStorage.setItem('habitflow_current_user', JSON.stringify(user));

      // Immediately restore this user's local data (instant, no flicker)
      const userHabitsKey = `habitflow_habits_${user.id}`;
      const userJournalKey = `habitflow_journal_${user.id}`;
      const userJSettingsKey = `habitflow_journal_settings_${user.id}`;
      const userASettingsKey = `habitflow_app_settings_${user.id}`;

      const localH = localStorage.getItem(userHabitsKey);
      const localJ = localStorage.getItem(userJournalKey);
      const localJS = localStorage.getItem(userJSettingsKey);
      const localAS = localStorage.getItem(userASettingsKey);

      if (localH) setHabits(JSON.parse(localH));
      if (localJ) setJournal(JSON.parse(localJ));
      if (localJS) setJournalSettings(JSON.parse(localJS));
      if (localAS) setAppSettings(JSON.parse(localAS));

      const loadFirebaseData = async () => {
        try {
          const { db } = await import('../lib/firebase');
          const { doc, onSnapshot, setDoc } = await import('firebase/firestore');

          let isFirstRemoteSync = true;

          const unsub = onSnapshot(
            doc(db, 'users', user.id),
            (userDoc) => {
              if (userDoc.metadata.hasPendingWrites) {
                return; // ignore local optimistic writes
              }

              // Do not overwrite if user performed a local edit in the last 2.5s
              if (Date.now() - lastLocalEditTime.current < 2500) {
                return;
              }

              if (userDoc.exists()) {
                const data = userDoc.data();

                if (data.habits && Array.isArray(data.habits)) {
                  const str = JSON.stringify(data.habits);
                  if (isFirstRemoteSync) {
                    const existingLocal = localStorage.getItem(userHabitsKey);
                    // If local was empty or we have remote habits, adopt remote
                    if (!existingLocal || JSON.parse(existingLocal).length === 0 || data.habits.length > 0) {
                      lastSyncedState.current.habits = str;
                      setHabits(data.habits);
                    }
                  } else if (str !== lastSyncedState.current.habits) {
                    lastSyncedState.current.habits = str;
                    setHabits(prev => JSON.stringify(prev) !== str ? data.habits : prev);
                  }
                } else if (isFirstRemoteSync) {
                  // Push user's local habits to remote if remote is empty
                  const existingLocal = localStorage.getItem(userHabitsKey);
                  if (existingLocal) {
                    const parsed = JSON.parse(existingLocal);
                    if (parsed.length > 0) {
                      setDoc(doc(db, 'users', user.id), { habits: parsed }, { merge: true }).catch(() => {});
                    }
                  }
                }

                if (data.journal && Array.isArray(data.journal)) {
                  const str = JSON.stringify(data.journal);
                  if (str !== lastSyncedState.current.journal) {
                    lastSyncedState.current.journal = str;
                    setJournal(prev => JSON.stringify(prev) !== str ? data.journal : prev);
                  }
                }

                if (data.journalSettings) {
                  const str = JSON.stringify(data.journalSettings);
                  if (str !== lastSyncedState.current.journalSettings) {
                    lastSyncedState.current.journalSettings = str;
                    setJournalSettings(prev => JSON.stringify(prev) !== str ? data.journalSettings : prev);
                  }
                }

                if (data.appSettings) {
                  const str = JSON.stringify(data.appSettings);
                  if (str !== lastSyncedState.current.appSettings) {
                    lastSyncedState.current.appSettings = str;
                    setAppSettings(prev => JSON.stringify(prev) !== str ? data.appSettings : prev);
                  }
                }
              }

              isFirstRemoteSync = false;
            },
            (error) => {
              console.warn("Firestore snapshot listener error:", error);
            }
          );
          unsubscribeFirebaseRef.current = unsub;
        } catch (error) {
          console.error("Failed to load Firebase data:", error);
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
    }

    return () => {
      if (unsubscribeFirebaseRef.current) {
        unsubscribeFirebaseRef.current();
        unsubscribeFirebaseRef.current = null;
      }
    };
  }, [user]);

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
    const newHabit: Habit = {
      ...habitData,
      id: crypto.randomUUID(),
      created: formatDate(new Date()),
      dates: [],
    };
    setHabits(prev => [...prev, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<Omit<Habit, 'id' | 'created'>>) => {
    lastLocalEditTime.current = Date.now();
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const deleteHabit = (id: string) => {
    lastLocalEditTime.current = Date.now();
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
        
        return { ...h, dates, progress };
      }
      return h;
    }));
  };

  const updateHabitProgress = (id: string, date: string, increment: number) => {
    lastLocalEditTime.current = Date.now();
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
        
        return { ...h, progress, dates };
      }
      return h;
    }));
  };

  const addJournalEntry = (data: Omit<JournalEntry, 'id'>) => {
    lastLocalEditTime.current = Date.now();
    const entry: JournalEntry = {
      ...data,
      id: crypto.randomUUID(),
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
      signOutAccount,
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
