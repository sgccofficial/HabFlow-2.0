import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { Play, Pause, Square, RefreshCcw, Bell, Flag } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { Habit } from '../types';

export function formatTime(secs: number, forceHours: boolean = true) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function parseTime(val: string) {
  const parts = val.split(':').map(Number);
  let totalSecs = 0;
  if (parts.length === 3) {
    totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    totalSecs = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    totalSecs = parts[0];
  }
  return isNaN(totalSecs) ? 0 : totalSecs;
}

let hasLoadedOnce = false;

export function TimerPage() {
  const { habits, activeHabitId, setActiveHabitId, toggleHabitDate, updateHabitProgress, setServerTimer, clearServerTimer } = useAppContext();
  
  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown');
  
  // Countdown States
  const [durationSecs, setDurationSecs] = useState(20 * 60); // 20 min default
  const [remainingSecs, setRemainingSecs] = useState(20 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatTime(20 * 60));
  const timerRef = useRef<number | null>(null);
  const previousRemainingSecsRef = useRef(20 * 60);
  
  // Stopwatch States
  const [swTime, setSwTime] = useState(0); // in ms
  const [swLaps, setSwLaps] = useState<number[]>([]);
  const [swIsRunning, setSwIsRunning] = useState(false);
  const swStartTimeRef = useRef<number>(0);
  const swAccumulatedRef = useRef<number>(0);
  const swIntervalRef = useRef<number | null>(null);

  const selectedHabit = habits.find(h => h.id === activeHabitId) || null;

  // Initialize duration from habit goal
  useEffect(() => {
    if (!isRunning && mode === 'countdown') {
      if (selectedHabit && selectedHabit.goalType === 'duration') {
         const todayStr = formatDate(new Date());
         const progress = selectedHabit.progress?.[todayStr] || 0;
         let targetSecs = 0;
         let remainingSecsForHabit = 0;
         if (selectedHabit.durationUnit === 'sec') {
           targetSecs = selectedHabit.goalValue || 0;
           remainingSecsForHabit = Math.max(0, targetSecs - progress);
         } else {
           const targetMins = selectedHabit.durationUnit === 'hr' ? (selectedHabit.goalValue || 0) * 60 : (selectedHabit.goalValue || 0);
           targetSecs = targetMins * 60;
           const remainingMins = Math.max(0, targetMins - progress);
           remainingSecsForHabit = remainingMins * 60;
         }
         
         if (remainingSecsForHabit > 0) {
           setDurationSecs(remainingSecsForHabit);
           setRemainingSecs(remainingSecsForHabit);
           setInputValue(formatTime(remainingSecsForHabit));
           previousRemainingSecsRef.current = remainingSecsForHabit;
         } else {
           // If completed today, still show the original target duration
           setDurationSecs(targetSecs);
           setRemainingSecs(targetSecs);
           setInputValue(formatTime(targetSecs));
           previousRemainingSecsRef.current = targetSecs;
         }
      } else {
         setDurationSecs(20 * 60);
         setRemainingSecs(20 * 60);
         setInputValue(formatTime(20 * 60));
         previousRemainingSecsRef.current = 20 * 60;
      }
    }
  }, [selectedHabit?.id]);

  // Track progress when running
  useEffect(() => {
    if (selectedHabit && selectedHabit.goalType === 'duration' && isRunning && mode === 'countdown') {
      if (selectedHabit.durationUnit === 'sec') {
        const oldSecs = durationSecs - previousRemainingSecsRef.current;
        const newSecs = durationSecs - remainingSecs;
        if (newSecs > oldSecs) {
           updateHabitProgress(selectedHabit.id, formatDate(new Date()), newSecs - oldSecs);
        }
      } else {
        const oldMins = Math.floor((durationSecs - previousRemainingSecsRef.current) / 60);
        const newMins = Math.floor((durationSecs - remainingSecs) / 60);
        if (newMins > oldMins) {
           updateHabitProgress(selectedHabit.id, formatDate(new Date()), newMins - oldMins);
        }
      }
    }
    previousRemainingSecsRef.current = remainingSecs;
  }, [remainingSecs, isRunning, selectedHabit, durationSecs, mode, updateHabitProgress]);

  // Countdown Effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setRemainingSecs(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Handle completion outside of state updater
  useEffect(() => {
    if (isRunning && remainingSecs === 0) {
      handleComplete();
    }
  }, [remainingSecs, isRunning]);

  // Stopwatch Effect
  useEffect(() => {
    if (swIsRunning) {
      swIntervalRef.current = window.setInterval(() => {
        setSwTime(swAccumulatedRef.current + (Date.now() - swStartTimeRef.current));
      }, 10);
    } else {
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    }
    return () => {
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    };
  }, [swIsRunning]);

  // Load from localstorage if page restores
  useEffect(() => {
    const savedState = localStorage.getItem('habitflow_timerState');
    if (savedState) {
      const parsed = JSON.parse(savedState);
      const habitStillExists = parsed.habitId ? habits.find(h => h.id === parsed.habitId) : true;
      
      if (!habitStillExists) {
        localStorage.removeItem('habitflow_timerState');
        setIsRunning(false);
        setDurationSecs(20 * 60);
        setRemainingSecs(20 * 60);
        setInputValue(formatTime(20 * 60));
        clearServerTimer();
        return;
      }

      if (parsed.isRunning && parsed.endTime && mode === 'countdown') {
        if (!hasLoadedOnce) {
          // JS was killed / fresh reload - pause at last known value
          setRemainingSecs(parsed.remainingSecs || 20 * 60);
          setDurationSecs(parsed.durationSecs || parsed.remainingSecs || 20 * 60);
          setInputValue(formatTime(parsed.remainingSecs || 20 * 60));
          setIsRunning(false);
        } else {
          // JS is alive / navigating back - keep running
          const now = Date.now();
          if (now < parsed.endTime) {
            setRemainingSecs(Math.floor((parsed.endTime - now) / 1000));
            setDurationSecs(parsed.durationSecs || 20 * 60);
            setIsRunning(true);
          } else {
            setRemainingSecs(0);
            setCompletedModalOpen(true);
          }
        }
      } else if (!parsed.isRunning && mode === 'countdown') {
         setRemainingSecs(parsed.remainingSecs || 20 * 60);
         setDurationSecs(parsed.durationSecs || parsed.remainingSecs || 20 * 60);
         setInputValue(formatTime(parsed.remainingSecs || 20 * 60));
         setIsRunning(false);
      }
    }
    hasLoadedOnce = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Save to localstorage
  useEffect(() => {
    if (mode === 'countdown') {
      if (isRunning) {
        const endTime = Date.now() + remainingSecs * 1000;
        localStorage.setItem('habitflow_timerState', JSON.stringify({ isRunning: true, endTime, habitId: activeHabitId, remainingSecs, durationSecs }));
      } else {
        localStorage.setItem('habitflow_timerState', JSON.stringify({ isRunning: false, remainingSecs, durationSecs, habitId: activeHabitId }));
      }
    }
  }, [isRunning, remainingSecs, durationSecs, mode, activeHabitId]);

  const handleComplete = () => {
    setIsRunning(false);
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    
    // Play sound if possible
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Time\'s Up!', {
        body: `Focus session completed.`,
      });
    }

    setCompletedModalOpen(true);
  };

  const formatSwTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const c = Math.floor((ms % 1000) / 10);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${c.toString().padStart(2, '0')}`;
  };

  // Countdown Handlers
  const handleStart = () => {
    setIsRunning(true);
    const title = selectedHabit ? selectedHabit.name : "Focus Session";
    setServerTimer(durationSecs, title);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Started', {
        body: `Focus session started for ${Math.floor(durationSecs / 60)} minutes.`,
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };
  
  const handlePause = () => {
    setIsRunning(false);
    setInputValue(formatTime(remainingSecs));
    clearServerTimer();
  };
  
  const handleReset = () => {
    setIsRunning(false);
    setRemainingSecs(durationSecs);
    setInputValue(formatTime(durationSecs));
    clearServerTimer();
  };

  // Stopwatch Handlers
  const handleSwStart = () => {
    swStartTimeRef.current = Date.now();
    setSwIsRunning(true);
  };
  const handleSwPause = () => {
    swAccumulatedRef.current += Date.now() - swStartTimeRef.current;
    setSwIsRunning(false);
  };
  const handleSwReset = () => {
    swAccumulatedRef.current = 0;
    setSwTime(0);
    setSwLaps([]);
    setSwIsRunning(false);
  };
  const handleSwLap = () => {
    setSwLaps(prev => [...prev, swAccumulatedRef.current + (Date.now() - swStartTimeRef.current)]);
  };

  const prevHabitIdRef = useRef<string | null>(activeHabitId);

  useEffect(() => {
    if (prevHabitIdRef.current !== activeHabitId) {
      if (isRunning) handleReset();
      if (swIsRunning) handleSwReset();
      
      const newHabit = habits.find(h => h.id === activeHabitId);
      if (!newHabit || newHabit.goalType !== 'duration') {
        setDurationSecs(20 * 60);
        setRemainingSecs(20 * 60);
        previousRemainingSecsRef.current = 20 * 60;
      }
      
      prevHabitIdRef.current = activeHabitId;
    }
  }, [activeHabitId, isRunning, swIsRunning, habits]);

  const progress = mode === 'countdown' 
    ? ((durationSecs - remainingSecs) / durationSecs) * 100
    : (swTime % 60000) / 60000 * 100; // Loop every minute

  const handleDone = () => {
    if (selectedHabit) {
      const today = formatDate(new Date());
      if (!selectedHabit.dates.includes(today)) {
        toggleHabitDate(selectedHabit.id, today);
      }
    }
    setCompletedModalOpen(false);
    handleReset();
  };

  const handleRunAgain = () => {
    setCompletedModalOpen(false);
    handleReset();
    handleStart();
  };

  return (
    <div className="pb-24 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-2rem)]">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timer</h1>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center">
          
          <select 
            value={activeHabitId || ''} 
            onChange={e => setActiveHabitId(e.target.value || null)}
            className="w-full mb-6 p-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">No habit selected</option>
            {habits.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>

          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-8">
            <button 
              onClick={() => { setMode('countdown'); setRemainingSecs(durationSecs); setIsRunning(false); }}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", mode === 'countdown' ? "bg-white dark:bg-gray-700 shadow flex items-center gap-1.5" : "text-gray-500")}
            >
              Countdown
            </button>
            <button 
              onClick={() => { setMode('stopwatch'); setRemainingSecs(0); setIsRunning(false); }}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", mode === 'stopwatch' ? "bg-white dark:bg-gray-700 shadow flex items-center gap-1.5" : "text-gray-500")}
            >
              Stopwatch
            </button>
          </div>

          <div className="relative w-80 h-80 mb-8 flex items-center justify-center">
            {/* SVG Ring */}
            {mode === 'countdown' && (
              <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="4" 
                  className="stroke-indigo-500 transition-all duration-1000 ease-linear"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (283 * progress) / 100}
                />
              </svg>
            )}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {mode === 'countdown' ? (
                (!isRunning && remainingSecs === durationSecs) ? (
                  <div className="flex flex-col items-center">
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        if (digits.length > 6) {
                          digits = digits.slice(digits.length - 6);
                        }
                        const padded = digits.padStart(6, '0');
                        const formatted = `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
                        setInputValue(formatted);
                      }}
                      onBlur={() => {
                        const secs = parseTime(inputValue);
                        if (secs > 0) {
                          setDurationSecs(secs);
                          setRemainingSecs(secs);
                          setInputValue(formatTime(secs));
                        } else {
                          setInputValue(formatTime(durationSecs));
                        }
                      }}
                      className="w-56 bg-transparent text-center border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:outline-none text-5xl font-mono tracking-tighter text-gray-900 dark:text-white"
                      style={{ MozAppearance: 'textfield' }}
                    />
                    <div className="flex gap-1 mt-4">
                      <button onClick={() => {setDurationSecs(5*60); setRemainingSecs(5*60); setInputValue(formatTime(5*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">5m</button>
                      <button onClick={() => {setDurationSecs(10*60); setRemainingSecs(10*60); setInputValue(formatTime(10*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">10m</button>
                      <button onClick={() => {setDurationSecs(30*60); setRemainingSecs(30*60); setInputValue(formatTime(30*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">30m</button>
                      <button onClick={() => {setDurationSecs(60*60); setRemainingSecs(60*60); setInputValue(formatTime(60*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">1hr</button>
                    </div>
                  </div>
                ) : (
                  <span className="text-5xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2">
                    {formatTime(remainingSecs)}
                  </span>
                )
              ) : (
                <span className="text-4xl font-mono tracking-tighter text-gray-900 dark:text-white mb-2 ml-2">
                  {formatSwTime(swTime)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {mode === 'countdown' ? (
              <>
                <button 
                  onClick={handleReset}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                >
                  <RefreshCcw className="w-5 h-5" />
                </button>
                <button 
                  onClick={isRunning ? handlePause : handleStart}
                  className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
                >
                  {isRunning ? <Pause className="w-6 h-6" fill="currentColor"/> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
                </button>
                <div className="w-12 h-12" /> {/* Layout balancer */}
              </>
            ) : (
              <>
                <button 
                  onClick={swIsRunning ? handleSwLap : handleSwReset}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                  title={swIsRunning ? "Lap" : "Reset"}
                >
                  {swIsRunning ? <Flag className="w-5 h-5" /> : <RefreshCcw className="w-5 h-5" />}
                </button>
                <button 
                  onClick={swIsRunning ? handleSwPause : handleSwStart}
                  className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95"
                >
                  {swIsRunning ? <Pause className="w-6 h-6" fill="currentColor"/> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
                </button>
                <button 
                  onClick={handleSwReset}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                  title="Stop"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                </button>
              </>
            )}
          </div>

          {mode === 'stopwatch' && swLaps.length > 0 && (
            <div className="w-full mt-8 border-t border-gray-100 dark:border-gray-800 pt-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
              {[...swLaps].reverse().map((lapTime, revI) => {
                const numLaps = swLaps.length;
                const i = numLaps - 1 - revI;
                const prevLap = i === 0 ? 0 : swLaps[i-1];
                const diff = lapTime - prevLap;
                return (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-800/50">
                    <span className="text-gray-500 font-medium text-sm">Lap {i + 1}</span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-gray-400 text-xs">+{formatSwTime(diff)}</span>
                      <span className="text-gray-900 dark:text-gray-200 font-medium">{formatSwTime(lapTime)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {completedModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-3xl p-6 text-center shadow-xl">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Time's Up!</h2>
            <p className="text-gray-500 mb-6">Great job staying focused.</p>
            
            <div className="space-y-3">
              <button 
                onClick={handleDone}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
              >
                {selectedHabit ? `Mark "${selectedHabit.name}" Done` : "Done"}
              </button>
              <button 
                onClick={handleRunAgain}
                className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
              >
                Run Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
