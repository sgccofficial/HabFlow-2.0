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
import { Moon, Sun, Palette, X, User, LogOut, Check, Camera, Mail, Trash2, AtSign } from 'lucide-react';
import { BACKGROUND_COLORS, BACKGROUND_TEXTURES } from './lib/constants';
import { ImageCropper } from './components/ImageCropper';
import { Eye, EyeOff } from 'lucide-react';

function AppContent() {
  const { currentPage, darkMode, toggleDarkMode, habits, appSettings, updateAppSettings, journal, user, setUser, addJournalEntry, setCurrentPage } = useAppContext();
  const checkedReminders = useRef<Set<string>>(new Set());
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [modalState, setModalState] = useState<{type: 'name' | 'real_name' | 'photo_options' | 'delete' | 'signout' | 'success' | 'auth_options' | 'create_account' | 'sign_in' | null, input: string, nameInput?: string, password?: string, profilePic?: string}>({type: null, input: '', nameInput: '', password: '', profilePic: ''});
  const [showPassword, setShowPassword] = useState(false);
  const [modalError, setModalError] = useState('');
  const [shareData, setShareData] = useState<{title: string, text: string, url: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || '';
    const text = params.get('text') || '';
    const url = params.get('url') || '';
    const page = params.get('page');

    if (page && ['habits', 'timer', 'journal', 'analytics'].includes(page)) {
      setCurrentPage(page as any);
      // clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('page');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }

    if (title || text || url) {
      setShareData({ title, text, url });
      // clean up the URL without refreshing
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('title');
      newUrl.searchParams.delete('text');
      newUrl.searchParams.delete('url');
      window.history.replaceState({}, document.title, newUrl.pathname + newUrl.search);
    }
  }, []);

  useEffect(() => {
    const handleDocumentClick = () => {
      setShowGlobalSettings(false);
      setShowProfileMenu(false);
    };
    document.addEventListener('click', handleDocumentClick);

    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const toggleGlobalSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowGlobalSettings(!showGlobalSettings);
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(!showProfileMenu);
    setShowGlobalSettings(false);
  };

  const handleModalSubmit = async () => {
    if (!modalState.type) return;
    
    try {
      const accountsStr = localStorage.getItem('habitflow_accounts');
      let accounts = accountsStr ? JSON.parse(accountsStr) : [];

      if (modalState.type === 'create_account') {
        const username = modalState.input.trim();
        const displayName = modalState.nameInput?.trim() || '';
        const pwd = modalState.password || '';
        if (!displayName) {
          setModalError("Name can't be left blank.");
          return;
        }
        if (!username) {
          setModalError("Username can't be left blank.");
          return;
        }
        if (!/^[a-zA-Z0-9._]+$/.test(username)) {
          setModalError("Username can only contain letters, numbers, periods, and underscores.");
          return;
        }
        if (pwd.length < 4 || pwd.length > 16) {
          setModalError("Password must have 4-16 characters.");
          return;
        }
        if (accounts.find((a: any) => a.username === username || a.name === username)) {
          setModalError("An account with this username already exists.");
          return;
        }
        const newUser = {
          id: crypto.randomUUID(),
          username,
          name: displayName,
          password: pwd,
          photoURL: modalState.profilePic || ''
        };
        accounts.push(newUser);
        localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
        
        setUser(newUser);
        setModalState({ type: 'success', input: 'Account created successfully!' });
        setTimeout(() => window.location.reload(), 1500);
        return;
      } else if (modalState.type === 'sign_in') {
        const username = modalState.input.trim();
        const pwd = modalState.password || '';
        const account = accounts.find((a: any) => (a.username === username || (a.name === username && !a.username)) && a.password === pwd);
        if (account) {
          setUser(account);
          setModalState({ type: 'success', input: 'Signed in successfully!' });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          if (pwd.length < 4 || pwd.length > 16) {
            setModalError("Password must have 4-16 characters.");
            return;
          }
          setModalError("Incorrect username or password.");
        }
        return;
      } else if (modalState.type === 'name') {
        if (!user) return;
        const newUsername = modalState.input.trim();
        if (newUsername === '') {
          setModalError("Username can't be left blank.");
          return;
        }
        if (!/^[a-zA-Z0-9._]+$/.test(newUsername)) {
          setModalError("Username can only contain letters, numbers, periods, and underscores.");
          return;
        }
        if (accounts.find((a: any) => a.id !== user.id && (a.username === newUsername || a.name === newUsername))) {
          setModalError("An account with this username already exists.");
          return;
        }
        const updatedUser = { ...user, username: newUsername };
        setUser(updatedUser);
        const idx = accounts.findIndex((a: any) => a.id === user.id);
        if (idx !== -1) {
          accounts[idx].username = newUsername;
          localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
        }
        setModalState({ type: 'success', input: 'Username updated successfully!' });
        setTimeout(() => window.location.reload(), 1500);
        return;
      } else if (modalState.type === 'real_name') {
        if (!user) return;
        const newName = modalState.input.trim();
        if (newName === '') {
          setModalError("Name can't be left blank.");
          return;
        }
        const updatedUser = { ...user, name: newName };
        setUser(updatedUser);
        const idx = accounts.findIndex((a: any) => a.id === user.id);
        if (idx !== -1) {
          accounts[idx].name = newName;
          localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
        }
        setModalState({ type: 'success', input: 'Name updated successfully!' });
        setTimeout(() => window.location.reload(), 1500);
        return;
      } else if (modalState.type === 'delete') {
        if (!user) return;
        accounts = accounts.filter((a: any) => a.id !== user.id);
        localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
        localStorage.removeItem(`habitflow_habits_${user.id}`);
        localStorage.removeItem(`habitflow_journal_${user.id}`);
        localStorage.removeItem(`habitflow_journal_settings_${user.id}`);
        localStorage.removeItem(`habitflow_app_settings_${user.id}`);
        setUser(null);
        window.location.reload();
      } else if (modalState.type === 'signout') {
        setUser(null);
        window.location.reload();
      }
      setModalState({ type: null, input: '' });
    } catch (error: any) {
      setModalError("Action failed: " + error.message);
    }
  };

  const handleUpdateName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!user) return;
    setModalState({ type: 'name', input: user.username || '' });
  };

  const handleUpdateRealName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!user) return;
    setModalState({ type: 'real_name', input: user.name || '' });
  };

  const handleUpdatePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!user) return;
    setModalState({ type: 'photo_options', input: '' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedImageFile(e.target.files[0]);
    }
    // reset so same file can be selected again
    e.target.value = '';
  };

  const handleCropSubmit = async (croppedBase64: string) => {
    setSelectedImageFile(null);
    if (!user) {
      if (modalState.type === 'create_account') {
        setModalState({ ...modalState, profilePic: croppedBase64 });
      }
      return;
    }
    try {
      const accountsStr = localStorage.getItem('habitflow_accounts');
      let accounts = accountsStr ? JSON.parse(accountsStr) : [];
      const updatedUser = { ...user, photoURL: croppedBase64 };
      setUser(updatedUser);
      const idx = accounts.findIndex((a: any) => a.id === user.id);
      if (idx !== -1) {
        accounts[idx].photoURL = croppedBase64;
        localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
      }
      setModalState({ type: 'success', input: 'Profile picture updated!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      alert("Action failed: " + error.message);
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    try {
      const accountsStr = localStorage.getItem('habitflow_accounts');
      let accounts = accountsStr ? JSON.parse(accountsStr) : [];
      const updatedUser = { ...user, photoURL: "" };
      setUser(updatedUser);
      const idx = accounts.findIndex((a: any) => a.id === user.id);
      if (idx !== -1) {
        accounts[idx].photoURL = "";
        localStorage.setItem('habitflow_accounts', JSON.stringify(accounts));
      }
      setModalState({ type: 'success', input: 'Profile picture removed!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Action failed: " + error.message);
    }
  };

  const handleDeleteAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!user) return;
    setModalState({ type: 'delete', input: '' });
  };

  const handleSignOutConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!user) return;
    setModalState({ type: 'signout', input: '' });
  };

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
      const currentDayOfWeek = now.getDay();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      habits.forEach(habit => {
        const isTargetDay = habit.targetDays ? habit.targetDays.includes(currentDayOfWeek) : true;
        const reminderId = `${habit.id}-${todayStr}`;
        if (isTargetDay && !habit.isFrozen && !checkedReminders.current.has(reminderId)) {
          if (!habit.dates.includes(todayStr) && habit.reminderTime === currentTimeStr) {
            // Trigger local notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Habit Reminder', {
                body: `Don't forget to complete: ${habit.name}`,
                icon: '/icon-192.png', // Fallback
                badge: '/badge.png'
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

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      document.body.style.setProperty('--bg-x', `${e.clientX * -0.05}px`);
      document.body.style.setProperty('--bg-y', `${e.clientY * -0.05}px`);
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  const globalColor = 'bg-white dark:bg-black';
  const globalTexture = appSettings?.texture || '';
  const textureObj = BACKGROUND_TEXTURES.find(t => t.class === globalTexture);
  const isImageBg = textureObj?.isImage;
  const imageUrl = isImageBg ? globalTexture.match(/url\(['"]?(.*?)['"]?\)/)?.[1] : null;

  return (
    <div 
      className={cn("relative font-sans antialiased min-h-screen transition-colors duration-300", globalColor, !isImageBg ? globalTexture : "")}
      style={{ 
        backgroundPosition: !isImageBg && globalTexture ? 'var(--bg-x) var(--bg-y)' : (isImageBg ? 'center' : undefined),
        backgroundImage: isImageBg && imageUrl ? `url('${imageUrl}')` : undefined,
        backgroundSize: isImageBg ? 'cover' : undefined,
        backgroundAttachment: isImageBg ? 'fixed' : undefined,
      }}
    >
      <header className="absolute top-0 left-0 right-0 p-4 flex justify-between pointer-events-none z-[60]">
        <div></div>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={toggleGlobalSettings}
            className={cn(
              "pointer-events-auto p-2.5 backdrop-blur rounded-full shadow border transition",
              showGlobalSettings ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" : "bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600"
            )}
          >
            <Palette className="w-5 h-5" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleDarkMode();
            }}
            className="pointer-events-auto p-2.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-full shadow border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          {user ? (
            <div className="relative pointer-events-auto flex items-center">
              <button 
                onClick={toggleProfileMenu}
                className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 shadow flex items-center justify-center bg-gray-100 dark:bg-gray-800"
              >
                {user.photoURL ? (
                  <img 
                    src={user.photoURL.replace(/=s\d+-c/i, '=s400-c')} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.nextElementSibling) {
                        (target.nextElementSibling as HTMLElement).style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 items-center justify-center" 
                  style={{ display: user.photoURL ? 'none' : 'flex' }}
                >
                  <User className="w-5 h-5" />
                </div>
              </button>
              
              {showProfileMenu && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-12 right-0 min-w-[16rem] w-max max-w-[90vw] sm:max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-[70] text-gray-900 dark:text-white">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex shrink-0 items-center justify-center bg-gray-100 dark:bg-gray-800">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL.replace(/=s\d+-c/i, '=s400-c')} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.nextElementSibling) {
                              (target.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-full h-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 items-center justify-center" 
                        style={{ display: user.photoURL ? 'none' : 'flex' }}
                      >
                        <User className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold break-words whitespace-normal">{user.name}</p>
                      <p className="text-xs text-gray-500 break-all whitespace-normal mt-0.5">@{user.username}</p>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={handleUpdateRealName}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <User className="w-4 h-4" /> Change Name
                    </button>
                    <button 
                      onClick={handleUpdateName}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <AtSign className="w-4 h-4" /> Change Username
                    </button>
                    <button 
                      onClick={handleUpdatePhoto}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Change Profile Picture
                    </button>
                  </div>
                  <div className="h-px bg-gray-100 dark:bg-gray-700 w-full" />
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={handleSignOutConfirm}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 flex items-center gap-2 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                    <button 
                      onClick={handleDeleteAccount}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => {
                setModalState({ type: 'auth_options', input: '' });
              }}
              className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow transition-colors text-sm font-medium h-10"
            >
              <User className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </header>

      {showGlobalSettings && (
        <div className="absolute inset-0 z-[100] flex justify-end p-4 pointer-events-none top-16">
          <div onClick={(e) => e.stopPropagation()} className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl w-full max-w-sm rounded-3xl p-6 shadow-2xl relative border border-gray-200/50 dark:border-gray-700/50 pointer-events-auto h-fit max-h-[80vh] overflow-y-auto">
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

      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        style={{ display: 'none' }} 
      />

      {selectedImageFile && (
        <ImageCropper 
          imageFile={selectedImageFile} 
          onCropSubmit={handleCropSubmit} 
          onCancel={() => {
            setSelectedImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }} 
        />
      )}

      {shareData && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Save Shared Content</h3>
            <p className="text-sm text-gray-500 mb-4 truncate">{shareData.title || shareData.text}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                   const contentParts = [];
                   if (shareData.title) contentParts.push(`# ${shareData.title}`);
                   if (shareData.text) contentParts.push(shareData.text);
                   if (shareData.url) contentParts.push(shareData.url);
                   
                   addJournalEntry({
                     habitId: '', // General journal
                     content: contentParts.join('\n\n'),
                     date: formatDate(new Date()),
                     createdAt: Date.now()
                   });
                   setShareData(null);
                   setCurrentPage('journal');
                }}
                className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition"
              >
                Save to Journal
              </button>
              <button 
                onClick={() => setShareData(null)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Modal */}
      {modalState.type && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-300">
            {modalState.type === 'success' ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <p className="text-xl font-medium text-gray-900 dark:text-white text-center">{modalState.input}</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  {modalState.type === 'name' && 'Change Username'}
                  {modalState.type === 'real_name' && 'Change Name'}
                  {modalState.type === 'photo_options' && 'Profile Picture'}
                  {modalState.type === 'delete' && 'Delete Account'}
                  {modalState.type === 'signout' && 'Sign Out'}
                  {modalState.type === 'auth_options' && 'Sign In'}
                  {modalState.type === 'create_account' && 'Create Account'}
                  {modalState.type === 'sign_in' && 'Sign In'}
                </h3>
                
                {modalState.type === 'auth_options' && (
                  <div className="flex flex-col gap-3 mb-2">
                    <button 
                      onClick={() => setModalState({ type: 'sign_in', input: '', password: '' })}
                      className="w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition text-center"
                    >
                      Sign In
                    </button>
                    <button 
                      onClick={() => setModalState({ type: 'create_account', input: '', password: '' })}
                      className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition text-center"
                    >
                      Create Account
                    </button>
                  </div>
                )}

                {['name', 'real_name', 'create_account', 'sign_in'].includes(modalState.type) && (
              <div className="mb-4 space-y-4">
                {modalState.type === 'create_account' && (
                  <div className="flex justify-center mb-6">
                    <button 
                      onClick={() => {
                        if (fileInputRef.current) fileInputRef.current.click();
                      }}
                      className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      {modalState.profilePic ? (
                        <img src={modalState.profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                    </button>
                  </div>
                )}
                {modalState.type === 'create_account' && (
                  <input
                    type="text"
                    maxLength={30}
                    value={modalState.nameInput || ''}
                    onChange={(e) => {
                      setModalState({ ...modalState, nameInput: e.target.value });
                      setModalError('');
                    }}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                    autoFocus
                  />
                )}
                <input
                  type="text"
                  maxLength={30}
                  value={modalState.input}
                  onChange={(e) => {
                    setModalState({ ...modalState, input: e.target.value });
                    setModalError('');
                  }}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                  placeholder={
                    modalState.type === 'create_account' ? 'Enter your username' :
                    modalState.type === 'sign_in' ? 'Enter your username' :
                    modalState.type === 'real_name' ? 'Enter your name' :
                    `Enter new username`
                  }
                  autoFocus={modalState.type !== 'create_account'}
                />
                
                {['create_account', 'sign_in'].includes(modalState.type) && (
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={modalState.password || ''}
                      onChange={(e) => {
                        setModalState({ ...modalState, password: e.target.value });
                        setModalError('');
                      }}
                      onPaste={(e) => e.preventDefault()}
                      onCopy={(e) => e.preventDefault()}
                      maxLength={16}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                      placeholder={modalState.type === 'sign_in' ? 'Password' : 'Password (4-16 chars)'}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {modalError && (
              <p className="text-red-500 text-sm mb-4 text-center">{modalError}</p>
            )}

            {modalState.type === 'photo_options' && (
              <div className="flex flex-col gap-2 mb-2">
                <button 
                  onClick={() => {
                    setModalState({ type: null, input: '' });
                    if (fileInputRef.current) fileInputRef.current.click();
                  }}
                  className="w-full px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition text-center"
                >
                  Upload New Picture
                </button>
                {user?.photoURL && (
                  <button 
                    onClick={async () => {
                      await handleDeletePhoto();
                    }}
                    className="w-full px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition text-center"
                  >
                    Remove Current Picture
                  </button>
                )}
                <button
                  onClick={() => setModalState({ type: null, input: '' })}
                  className="w-full px-4 py-2 text-gray-600 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-center mt-1"
                >
                  Cancel
                </button>
              </div>
            )}
            
            {modalState.type === 'delete' && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                Are you sure you want to delete your account? This action cannot be undone and you will lose all your data.
              </p>
            )}

            {modalState.type === 'signout' && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to sign out?
              </p>
            )}

            {modalState.type !== 'photo_options' && (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setModalState({ type: null, input: '' });
                    setModalError('');
                    setShowPassword(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                {modalState.type !== 'auth_options' && (
                  <button
                    onClick={handleModalSubmit}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium text-white transition",
                      ['delete', 'signout'].includes(modalState.type) ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                    )}
                  >
                    {modalState.type === 'create_account' ? 'Create' : modalState.type === 'sign_in' ? 'Sign In' : 'Confirm'}
                  </button>
                )}
              </div>
            )}
            </>
            )}
          </div>
        </div>
      )}
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

