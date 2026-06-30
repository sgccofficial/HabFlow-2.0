import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('habitflow_habits');
    return saved ? JSON.parse(saved) : [];
  });

  const [journal, setJournal] = useState<JournalEntry[]>(() => {
    const saved = localStorage.getItem('habitflow_journal');
    return saved ? JSON.parse(saved) : [];
  });

  const [journalSettings, setJournalSettings] = useState<Record<string, JournalSettings>>(() => {
    const saved = localStorage.getItem('habitflow_journal_settings');
    return saved ? JSON.parse(saved) : {};
  });

  const [appSettings, setAppSettings] = useState<JournalSettings>(() => {
    const saved = localStorage.getItem('habitflow_app_settings');
    return saved ? JSON.parse(saved) : {};
  });

  const [currentPage, setCurrentPage] = useState<Page>('habits');
  const [activeHabitId, setActiveHabitId] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    import('../lib/firebase').then(({ auth }) => {
      if (auth) {
        auth.onAuthStateChanged((u: any) => {
          if (u) {
            const localPic = localStorage.getItem(`profile_pic_${u.uid}`);
            if (localPic) {
              u.photoURL = localPic;
            }
          }
          setUser(u ? { ...u } : null);
        });
      }
    }).catch(e => console.error("Firebase not init", e));
  }, []);

  useEffect(() => {
    if (!user) return;
    const backupData = async () => {
      try {
        const { db } = await import('../lib/firebase');
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'users', user.uid), {
          habits,
          journal,
          journalSettings,
          appSettings,
          lastBackup: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        console.error('Failed to backup data:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backupData();
      }
    };
    const handleBeforeUnload = () => {
      backupData();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, habits, journal, journalSettings, appSettings]);

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

  useEffect(() => {
    localStorage.setItem('habitflow_habits', JSON.stringify(habits));
    syncNotificationSettings(habits);
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('habitflow_journal', JSON.stringify(journal));
  }, [journal]);

  useEffect(() => {
    localStorage.setItem('habitflow_journal_settings', JSON.stringify(journalSettings));
  }, [journalSettings]);

  useEffect(() => {
    localStorage.setItem('habitflow_app_settings', JSON.stringify(appSettings));
  }, [appSettings]);

  const updateJournalSettings = (habitId: string, settings: JournalSettings) => {
    setJournalSettings(prev => ({ ...prev, [habitId]: { ...prev[habitId], ...settings } }));
  };

  useEffect(() => {
    if (swSubscription) {
      syncNotificationSettings(habits, swSubscription);
    }
  }, [habits, swSubscription]);

  const updateAppSettings = (settings: JournalSettings) => {
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
      .filter(h => h.reminderTime)
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
      .filter(h => h.reminderTime)
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
      .filter(h => h.reminderTime)
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
    const newHabit: Habit = {
      ...habitData,
      id: crypto.randomUUID(),
      created: formatDate(new Date()),
      dates: [],
    };
    setHabits([...habits, newHabit]);
  };

  const updateHabit = (id: string, updates: Partial<Omit<Habit, 'id' | 'created'>>) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    // also clean up journal? Optional, but good practice.
    setJournal(prev => prev.filter(j => j.habitId !== id));
    if (activeHabitId === id) setActiveHabitId(null);
  };

  const reorderHabits = (newHabits: Habit[]) => {
    setHabits(newHabits);
  };

  const toggleHabitDate = (id: string, date: string) => {
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
        } else if (next === 0 && dates.includes(date)) {
          dates = dates.filter(d => d !== date);
        }
        
        return { ...h, progress, dates };
      }
      return h;
    }));
  };

  const addJournalEntry = (data: Omit<JournalEntry, 'id'>) => {
    const entry: JournalEntry = {
      ...data,
      id: crypto.randomUUID(),
    };
    setJournal([...journal, entry]);
  };

  const updateJournalEntry = (id: string, content: string) => {
    setJournal(journal.map(j => j.id === id ? { ...j, content } : j));
  };

  const deleteJournalEntry = (id: string) => {
    setJournal(journal.filter(j => j.id !== id));
  };

  return (
    <AppContext.Provider value={{
      habits, journal, journalSettings, appSettings, currentPage, setCurrentPage, activeHabitId, setActiveHabitId, user,
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
