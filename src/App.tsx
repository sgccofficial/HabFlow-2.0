/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, useAppContext } from './store/AppContext';
import { BottomNav } from './components/BottomNav';
import { HabitsPage } from './components/HabitsPage';
import { TimerPage } from './components/TimerPage';
import { JournalPage } from './components/JournalPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { formatDate, cn } from './lib/utils';
import { Moon, Sun, Palette, X } from 'lucide-react';
import { BACKGROUND_COLORS, BACKGROUND_TEXTURES } from './lib/constants';

function AppContent() {
  const { currentPage, darkMode, toggleDarkMode, habits, appSettings, updateAppSettings, journal } = useAppContext();
  const checkedReminders = useRef<Set<string>>(new Set());
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);

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

  useEffect(() => {
    setShowGlobalSettings(false);
  }, [currentPage]);

  useEffect(() => {
    if (appSettings?.isRandomBackground) {
      const textures = BACKGROUND_TEXTURES.filter(t => t.name !== 'None');
      const randomTexture = textures[Math.floor(Math.random() * textures.length)].class;
      updateAppSettings({ texture: randomTexture });
    }
  }, [currentPage, habits, journal]);

  const globalColor = 'bg-white dark:bg-black';
  const globalTexture = appSettings?.texture || '';
  const isImageBg = BACKGROUND_TEXTURES.find(t => t.class === globalTexture)?.isImage;

  return (
    <div className={cn("font-sans antialiased min-h-screen transition-colors duration-300", globalColor, globalTexture, isImageBg ? "bg-is-image" : "")}>
      <header className="fixed top-0 left-0 right-0 p-4 flex justify-between pointer-events-none z-[60]">
        <div />
        <div className="flex gap-2">
          <button 
            onClick={() => setShowGlobalSettings(!showGlobalSettings)}
            className={cn(
              "pointer-events-auto p-2 backdrop-blur rounded-full shadow border transition",
              showGlobalSettings ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" : "bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600"
            )}
          >
            <Palette className="w-5 h-5" />
          </button>
          <button 
            onClick={toggleDarkMode}
            className="pointer-events-auto p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-full shadow border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {showGlobalSettings && (
        <div className="fixed inset-0 z-[100] flex justify-end p-4 pointer-events-none top-16">
          <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border border-gray-200/50 dark:border-gray-700/50 pointer-events-auto h-fit max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Palette</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Random</span>
                <input 
                  type="checkbox" 
                  checked={!!appSettings?.isRandomBackground}
                  onChange={(e) => updateAppSettings({ isRandomBackground: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Texture</label>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_TEXTURES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => updateAppSettings({ texture: t.class, isRandomBackground: false })}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                      appSettings?.texture === t.class && !appSettings?.isRandomBackground
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                        : "bg-transparent border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4">
        {currentPage === 'habits' && <HabitsPage />}
        {currentPage === 'timer' && <TimerPage />}
        {currentPage === 'journal' && <JournalPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
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

