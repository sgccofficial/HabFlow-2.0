/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { BottomNav } from './components/BottomNav';
import { HabitsPage } from './components/HabitsPage';
import { TimerPage } from './components/TimerPage';
import { JournalPage } from './components/JournalPage';
import { formatDate } from './lib/utils';
import { Moon, Sun } from 'lucide-react';

function AppContent() {
  const { currentPage, darkMode, toggleDarkMode, habits } = useAppContext();
  const checkedReminders = useRef<Set<string>>(new Set());

  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', darkMode ? '#030712' : '#ffffff');
    }
  }, [darkMode]);

  // Reminder Checker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const todayStr = formatDate(now);
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      habits.forEach(habit => {
        const reminderId = `${habit.id}-${todayStr}`;
        if (!checkedReminders.current.has(reminderId)) {
          if (!habit.dates.includes(todayStr) && habit.reminderTime === currentTimeStr) {
            // Trigger local notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Habit Reminder', {
                body: `Don't forget to complete: ${habit.name}`,
                icon: '/icon.png', // Fallback
              });
            }
            checkedReminders.current.add(reminderId);
          }
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [habits]);

  return (
    <div className="font-sans antialiased min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 p-4 flex justify-end pointer-events-none z-50">
        <button 
          onClick={toggleDarkMode}
          className="pointer-events-auto p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-full shadow border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      <div className="pt-4">
        {currentPage === 'habits' && <HabitsPage />}
        {currentPage === 'timer' && <TimerPage />}
        {currentPage === 'journal' && <JournalPage />}
      </div>
      
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

