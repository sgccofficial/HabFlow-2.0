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
import { Moon, Sun, Palette, X, User, LogOut, Check } from 'lucide-react';
import { BACKGROUND_COLORS, BACKGROUND_TEXTURES } from './lib/constants';
import { auth, signInWithPopup, googleProvider, signOut } from './lib/firebase';
import { updateProfile, updateEmail, deleteUser, verifyBeforeUpdateEmail } from 'firebase/auth';

import { ImageCropper } from './components/ImageCropper';

function AppContent() {
  const { currentPage, darkMode, toggleDarkMode, habits, appSettings, updateAppSettings, journal, user } = useAppContext();
  const checkedReminders = useRef<Set<string>>(new Set());
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [modalState, setModalState] = useState<{type: 'name' | 'photo_options' | 'email_current' | 'email_new' | 'email_verify' | 'delete' | 'signout' | 'success' | null, input: string}>({type: null, input: ''});
  const [modalError, setModalError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

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
    if (!auth.currentUser || !modalState.type) return;
    
    try {
      if (modalState.type === 'name') {
        if (modalState.input.trim() === '') throw new Error('Name cannot be empty');
        await updateProfile(auth.currentUser, { displayName: modalState.input.trim() });
        if (user) user.displayName = modalState.input.trim();
        setModalState({ type: 'success', input: 'Name updated successfully!' });
        setTimeout(() => window.location.reload(), 1500);
        return;
      } else if (modalState.type === 'email_current') {
        if (modalState.input.trim() !== user?.email) {
          setModalError('Check again!');
          return;
        }
        setModalError('');
        setModalState({ type: 'email_new', input: '' });
        return;
      } else if (modalState.type === 'email_new') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(modalState.input.trim())) {
          setModalError('A valid email is needed');
          return;
        }
        setModalError('');
        await verifyBeforeUpdateEmail(auth.currentUser, modalState.input.trim());
        setModalState({ type: 'email_verify', input: '' });
        return;
      } else if (modalState.type === 'email_verify') {
        setModalState({ type: null, input: '' });
        window.location.reload();
        return;
      } else if (modalState.type === 'delete') {
        await deleteUser(auth.currentUser);
      } else if (modalState.type === 'signout') {
        await signOut(auth);
      }
      setModalState({ type: null, input: '' });
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setModalError("For security reasons, please sign out and sign back in before performing this action.");
      } else {
        setModalError("Action failed: " + error.message);
      }
    }
  };

  const handleUpdateName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!auth.currentUser) return;
    setModalState({ type: 'name', input: user?.displayName || '' });
  };

  const handleUpdatePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!auth.currentUser) return;
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
    if (!auth.currentUser) return;
    try {
      try {
        await updateProfile(auth.currentUser, { photoURL: croppedBase64 });
      } catch (e) {
        console.warn('Firebase Auth photo limit reached, using local storage fallback', e);
      }
      if (user) user.photoURL = croppedBase64;
      localStorage.setItem(`profile_pic_${auth.currentUser.uid}`, croppedBase64);
      setModalState({ type: 'success', input: 'Profile picture updated!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      alert("Action failed: " + error.message);
    }
  };

  const handleDeletePhoto = async () => {
    if (!auth.currentUser) return;
    try {
      try {
        await updateProfile(auth.currentUser, { photoURL: "" });
      } catch (e) {
        console.warn('Firebase Auth photo removal error', e);
      }
      if (user) user.photoURL = "";
      localStorage.removeItem(`profile_pic_${auth.currentUser.uid}`);
      setModalState({ type: 'success', input: 'Profile picture removed!' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Action failed: " + error.message);
    }
  };

  const handleUpdateEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!auth.currentUser) return;
    setModalState({ type: 'email_current', input: '' });
  };

  const handleDeleteAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!auth.currentUser) return;
    setModalState({ type: 'delete', input: '' });
  };

  const handleSignOutConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileMenu(false);
    if (!auth.currentUser) return;
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
        <div></div>
        <div className="flex gap-2 relative">
          <button 
            onClick={toggleGlobalSettings}
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
          
          {user ? (
            <div className="relative pointer-events-auto">
              <button 
                onClick={toggleProfileMenu}
                className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-800 shadow"
              >
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-full h-full object-cover" />
              </button>
              
              {showProfileMenu && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-12 right-0 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-[70] text-gray-900 dark:text-white">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-bold truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={handleUpdateName}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Change Name
                    </button>
                    <button 
                      onClick={handleUpdatePhoto}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Change Profile Picture
                    </button>
                    <button 
                      onClick={handleUpdateEmail}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Update Email
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
                      <User className="w-4 h-4" /> Delete Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, googleProvider)}
              className="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow transition-colors text-sm font-medium h-10"
            >
              <User className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </header>

      {showGlobalSettings && (
        <div className="fixed inset-0 z-[100] flex justify-end p-4 pointer-events-none top-16">
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
                  {modalState.type === 'name' && 'Change Name'}
                  {modalState.type === 'photo_options' && 'Profile Picture'}
                  {modalState.type === 'email_current' && 'Confirm Current Email'}
                  {modalState.type === 'email_new' && 'Enter New Email'}
                  {modalState.type === 'email_verify' && 'Verify Email'}
                  {modalState.type === 'delete' && 'Delete Account'}
                  {modalState.type === 'signout' && 'Sign Out'}
                </h3>
                
                {['name', 'email_current', 'email_new'].includes(modalState.type) && (
              <div className="mb-4">
                <input
                  type={modalState.type.startsWith('email') ? 'email' : 'text'}
                  value={modalState.input}
                  onChange={(e) => {
                    setModalState({ ...modalState, input: e.target.value });
                    setModalError('');
                  }}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white"
                  placeholder={
                    modalState.type === 'email_current' ? 'Enter current email' :
                    modalState.type === 'email_new' ? 'Enter new email' :
                    `Enter new ${modalState.type}`
                  }
                  autoFocus
                />
              </div>
            )}

            {modalError && (
              <p className="text-red-500 text-sm mb-4 text-center">{modalError}</p>
            )}

            {modalState.type === 'email_verify' && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Verification Link Sent. Please check your inbox and tap the link to change your email, then click Done.
              </p>
            )}
            
            {modalState.type === 'photo_options' && (
              <div className="flex flex-col gap-2 mb-4">
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
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalSubmit}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium text-white transition",
                    ['delete', 'signout'].includes(modalState.type) ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {modalState.type === 'email_current' || modalState.type === 'email_new' ? 'Next' : modalState.type === 'email_verify' ? 'Done' : 'Confirm'}
                </button>
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

