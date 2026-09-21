import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { Play, Pause, Square, RefreshCcw, Bell, Flag } from 'lucide-react';
import { cn, formatDate } from '../lib/utils';
import { Habit } from '../types';
import { getIcon } from './HabitCard';

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

export function TimerPage() {
  const { 
    habits, 
    activeHabitId, 
    setActiveHabitId, 
    toggleHabitDate, 
    updateHabitProgress, 
    setServerTimer, 
    clearServerTimer 
  } = useAppContext();
  
  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown');
  
  // Countdown States
  const [durationSecs, setDurationSecs] = useState(20 * 60); // default 20 mins
  const [remainingSecs, setRemainingSecs] = useState(20 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedModalOpen, setCompletedModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState(formatTime(20 * 60));
  
  // High-precision clock refs
  const targetEndTimeRef = useRef<number | null>(null);
  const durationSecsRef = useRef<number>(20 * 60);
  const remainingSecsRef = useRef<number>(20 * 60);
  const isRunningRef = useRef<boolean>(false);
  const lastLoggedSecsRef = useRef<number>(0);

  // Background ticker and wake lock refs
  const workerRef = useRef<Worker | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  
  // Stopwatch States
  const [swTime, setSwTime] = useState(0); // in ms
  const [swLaps, setSwLaps] = useState<number[]>([]);
  const [swIsRunning, setSwIsRunning] = useState(false);
  const swStartTimeRef = useRef<number>(0);
  const swAccumulatedRef = useRef<number>(0);
  const swIsRunningRef = useRef<boolean>(false);

  // Habit selection dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevHabitIdRef = useRef<string | null>(activeHabitId);

  // Keep durationSecsRef in sync
  useEffect(() => {
    durationSecsRef.current = durationSecs;
  }, [durationSecs]);

  // Keep remainingSecsRef in sync
  useEffect(() => {
    remainingSecsRef.current = remainingSecs;
  }, [remainingSecs]);

  // Keep isRunningRef in sync
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Keep swIsRunningRef in sync
  useEffect(() => {
    swIsRunningRef.current = swIsRunning;
  }, [swIsRunning]);

  // Handle outside click for habit dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedHabit = habits.find(h => h.id === activeHabitId) || null;

  // Sound and vibration alerts on completion
  const playAlarm = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 500]);
      }
    } catch (e) {
      console.warn("Vibration failed", e);
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const playBeep = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.3, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };
        const t = ctx.currentTime;
        playBeep(659.25, t, 0.2);        // E5
        playBeep(783.99, t + 0.22, 0.2); // G5
        playBeep(1046.50, t + 0.45, 0.4); // C6
      }
    } catch (e) {
      console.warn("Audio alarm failed", e);
    }
  };

  // Screen Wake Lock API to prevent phone screen from locking during timer
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        }
      }
    } catch (e) {
      // Ignore wake lock rejection (e.g. low battery mode)
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  };

  // Commit elapsed time to habit progress
  const commitProgress = (elapsedSecs: number) => {
    if (!selectedHabit || selectedHabit.goalType !== 'duration') return;
    const diffSecs = elapsedSecs - lastLoggedSecsRef.current;
    if (diffSecs <= 0) return;

    const todayStr = formatDate(new Date());
    if (selectedHabit.durationUnit === 'sec') {
      updateHabitProgress(selectedHabit.id, todayStr, diffSecs);
      lastLoggedSecsRef.current = elapsedSecs;
    } else {
      const oldMins = Math.floor(lastLoggedSecsRef.current / 60);
      const newMins = Math.floor(elapsedSecs / 60);
      const diffMins = newMins - oldMins;
      if (diffMins > 0) {
        updateHabitProgress(selectedHabit.id, todayStr, diffMins);
        lastLoggedSecsRef.current = newMins * 60;
      }
    }
  };

  // Save countdown state to localStorage
  const saveCountdownState = (
    running: boolean,
    remSecs: number,
    durSecs: number,
    loggedSecs: number,
    targetEnd: number | null = null
  ) => {
    try {
      const stateObj = {
        isRunning: running,
        targetEndTime: targetEnd,
        remainingSecs: remSecs,
        durationSecs: durSecs,
        habitId: activeHabitId,
        lastLoggedSecs: loggedSecs
      };
      localStorage.setItem('habitflow_timerState', JSON.stringify(stateObj));
    } catch (e) {}
  };

  // Save stopwatch state to localStorage
  const saveSwState = (
    running: boolean,
    accum: number,
    start: number,
    laps: number[]
  ) => {
    try {
      localStorage.setItem('habitflow_swState', JSON.stringify({
        swIsRunning: running,
        swAccumulated: accum,
        swStartTime: start,
        swLaps: laps
      }));
    } catch (e) {}
  };

  // Trigger completion
  const handleComplete = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    targetEndTimeRef.current = null;
    workerRef.current?.postMessage('STOP');
    releaseWakeLock();
    clearServerTimer();

    // Ensure all duration progress is committed
    commitProgress(durationSecsRef.current);

    saveCountdownState(false, 0, durationSecsRef.current, durationSecsRef.current, null);
    playAlarm();
    setCompletedModalOpen(true);

    // Send push/notification if available
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const habitTitle = selectedHabit ? selectedHabit.name : "Focus Session";
        const notifTitle = "Time's Up !!";
        const notifBody = `Great job! Your timer for "${habitTitle}" has finished.`;

        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(notifTitle, {
              body: notifBody,
              icon: '/icon-192.png',
              badge: '/badge.png'
            });
          }).catch(() => {
            new Notification(notifTitle, { body: notifBody, icon: '/icon-192.png' });
          });
        }
      }
    } catch (e) {}
  };

  // Core clock-anchored tick function
  const handleTick = () => {
    // Countdown check
    if (isRunningRef.current && targetEndTimeRef.current !== null) {
      const now = Date.now();
      const leftMs = targetEndTimeRef.current - now;
      const leftSecs = Math.max(0, Math.ceil(leftMs / 1000));
      
      setRemainingSecs(leftSecs);
      remainingSecsRef.current = leftSecs;

      const elapsed = Math.max(0, durationSecsRef.current - leftSecs);
      commitProgress(elapsed);

      if (leftSecs <= 0) {
        handleComplete();
        return;
      }
    }

    // Stopwatch check
    if (swIsRunningRef.current && swStartTimeRef.current > 0) {
      const elapsedMs = swAccumulatedRef.current + (Date.now() - swStartTimeRef.current);
      setSwTime(elapsedMs);
    }
  };

  // Setup Web Worker for background ticking (immune to main-thread background throttling)
  useEffect(() => {
    let worker: Worker | null = null;
    try {
      const workerScript = `
        var timerId = null;
        self.onmessage = function(e) {
          if (e.data === 'START') {
            if (timerId) clearInterval(timerId);
            timerId = setInterval(function() {
              self.postMessage('TICK');
            }, 300);
          } else if (e.data === 'STOP') {
            if (timerId) clearInterval(timerId);
            timerId = null;
          }
        };
      `;
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
      worker.onmessage = () => {
        handleTick();
      };
      workerRef.current = worker;

      // Start worker if already running
      if (isRunningRef.current || swIsRunningRef.current) {
        worker.postMessage('START');
      }
    } catch (err) {
      console.warn("Dedicated web worker not supported in this environment", err);
    }

    return () => {
      if (worker) {
        worker.postMessage('STOP');
        worker.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Fallback interval for main thread
  useEffect(() => {
    if (isRunning || swIsRunning) {
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = window.setInterval(handleTick, 400);
    } else {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    }
    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [isRunning, swIsRunning]);

  // Multi-event listeners for instant synchronization when waking from screen off or returning from other apps
  useEffect(() => {
    const syncOnWakeup = () => {
      handleTick();
      if (document.visibilityState === 'visible') {
        if (isRunningRef.current || swIsRunningRef.current) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', syncOnWakeup);
    window.addEventListener('focus', syncOnWakeup);
    window.addEventListener('pageshow', syncOnWakeup);

    return () => {
      document.removeEventListener('visibilitychange', syncOnWakeup);
      window.removeEventListener('focus', syncOnWakeup);
      window.removeEventListener('pageshow', syncOnWakeup);
    };
  }, [selectedHabit]);

  // Restore saved timer and stopwatch states from localStorage on mount
  useEffect(() => {
    // Restore countdown state
    const savedCountdown = localStorage.getItem('habitflow_timerState');
    if (savedCountdown) {
      try {
        const parsed = JSON.parse(savedCountdown);
        const habitStillExists = parsed.habitId ? habits.some(h => h.id === parsed.habitId) : true;
        
        if (!habitStillExists) {
          localStorage.removeItem('habitflow_timerState');
        } else {
          const dur = parsed.durationSecs || 20 * 60;
          setDurationSecs(dur);
          durationSecsRef.current = dur;
          lastLoggedSecsRef.current = parsed.lastLoggedSecs || 0;

          if (parsed.isRunning && parsed.targetEndTime) {
            const now = Date.now();
            if (now < parsed.targetEndTime) {
              const left = Math.max(0, Math.ceil((parsed.targetEndTime - now) / 1000));
              setRemainingSecs(left);
              remainingSecsRef.current = left;
              setInputValue(formatTime(left));
              setIsRunning(true);
              isRunningRef.current = true;
              targetEndTimeRef.current = parsed.targetEndTime;
              
              // Credit any progress made while inactive
              const elapsed = Math.max(0, dur - left);
              commitProgress(elapsed);

              workerRef.current?.postMessage('START');
              requestWakeLock();
            } else {
              // Expired while phone was in pocket / locked / browser tab suspended!
              setRemainingSecs(0);
              remainingSecsRef.current = 0;
              setInputValue(formatTime(0));
              setIsRunning(false);
              isRunningRef.current = false;
              targetEndTimeRef.current = null;
              commitProgress(dur);
              setCompletedModalOpen(true);
              saveCountdownState(false, 0, dur, dur, null);
              playAlarm();
            }
          } else {
            const left = parsed.remainingSecs !== undefined ? parsed.remainingSecs : dur;
            setRemainingSecs(left);
            remainingSecsRef.current = left;
            setInputValue(formatTime(left));
          }
        }
      } catch (e) {}
    }

    // Restore stopwatch state
    const savedSw = localStorage.getItem('habitflow_swState');
    if (savedSw) {
      try {
        const parsedSw = JSON.parse(savedSw);
        setSwLaps(parsedSw.swLaps || []);
        if (parsedSw.swIsRunning && parsedSw.swStartTime) {
          swStartTimeRef.current = parsedSw.swStartTime;
          swAccumulatedRef.current = parsedSw.swAccumulated || 0;
          swIsRunningRef.current = true;
          setSwIsRunning(true);
          const elapsed = swAccumulatedRef.current + (Date.now() - swStartTimeRef.current);
          setSwTime(elapsed);
          workerRef.current?.postMessage('START');
          requestWakeLock();
        } else {
          swAccumulatedRef.current = parsedSw.swAccumulated || 0;
          setSwTime(parsedSw.swAccumulated || 0);
        }
      } catch (e) {}
    }
  }, []);

  // Initialize duration from habit goal when habit changes or when idle
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
          durationSecsRef.current = remainingSecsForHabit;
          setRemainingSecs(remainingSecsForHabit);
          remainingSecsRef.current = remainingSecsForHabit;
          setInputValue(formatTime(remainingSecsForHabit));
          lastLoggedSecsRef.current = 0;
        } else {
          setDurationSecs(targetSecs);
          durationSecsRef.current = targetSecs;
          setRemainingSecs(targetSecs);
          remainingSecsRef.current = targetSecs;
          setInputValue(formatTime(targetSecs));
          lastLoggedSecsRef.current = 0;
        }
      } else if (!selectedHabit) {
        setDurationSecs(20 * 60);
        durationSecsRef.current = 20 * 60;
        setRemainingSecs(20 * 60);
        remainingSecsRef.current = 20 * 60;
        setInputValue(formatTime(20 * 60));
        lastLoggedSecsRef.current = 0;
      }
    }
  }, [selectedHabit?.id]);

  // Reset timer if active habit changed
  useEffect(() => {
    if (prevHabitIdRef.current !== activeHabitId) {
      if (isRunning) handleReset();
      if (swIsRunning) handleSwReset();
      
      const newHabit = habits.find(h => h.id === activeHabitId);
      if (!newHabit || newHabit.goalType !== 'duration') {
        setDurationSecs(20 * 60);
        durationSecsRef.current = 20 * 60;
        setRemainingSecs(20 * 60);
        remainingSecsRef.current = 20 * 60;
        setInputValue(formatTime(20 * 60));
        lastLoggedSecsRef.current = 0;
      }
      
      prevHabitIdRef.current = activeHabitId;
    }
  }, [activeHabitId, habits]);

  // Countdown Handlers
  const handleStart = () => {
    const currentRem = remainingSecs <= 0 ? durationSecs : remainingSecs;
    const now = Date.now();
    const targetEnd = now + currentRem * 1000;
    
    targetEndTimeRef.current = targetEnd;
    durationSecsRef.current = durationSecs;
    remainingSecsRef.current = currentRem;
    isRunningRef.current = true;
    setIsRunning(true);
    setRemainingSecs(currentRem);
    setInputValue(formatTime(currentRem));

    saveCountdownState(true, currentRem, durationSecs, lastLoggedSecsRef.current, targetEnd);

    workerRef.current?.postMessage('START');
    requestWakeLock();

    const title = selectedHabit ? selectedHabit.name : "Focus Session";
    setServerTimer(currentRem, title);

    // Send push or local notification if allowed
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const hrs = Math.floor(currentRem / 3600);
        const mins = Math.floor((currentRem % 3600) / 60);
        const secs = currentRem % 60;
        let timeString = '';
        if (hrs > 0) timeString += `${hrs} hour${hrs > 1 ? 's' : ''} `;
        if (mins > 0) timeString += `${mins} minute${mins > 1 ? 's' : ''} `;
        if (secs > 0 || timeString === '') timeString += `${secs} second${secs > 1 ? 's' : ''}`;
        timeString = timeString.trim();

        const notifBody = `${title}'s timer is set for ${timeString}.`;
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('Timer Started...', {
              body: notifBody,
              icon: '/icon-192.png',
              badge: '/badge.png'
            });
          }).catch(() => {
            new Notification('Timer Started...', { body: notifBody, icon: '/icon-192.png' });
          });
        }
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch (e) {
      console.warn("Notification error:", e);
    }
  };
  
  const handlePause = () => {
    const now = Date.now();
    let currentLeft = remainingSecs;
    if (targetEndTimeRef.current) {
      currentLeft = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
    }
    targetEndTimeRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setRemainingSecs(currentLeft);
    remainingSecsRef.current = currentLeft;
    setInputValue(formatTime(currentLeft));

    if (!swIsRunningRef.current) {
      workerRef.current?.postMessage('STOP');
      releaseWakeLock();
    }
    clearServerTimer();

    const elapsed = Math.max(0, durationSecs - currentLeft);
    commitProgress(elapsed);
    saveCountdownState(false, currentLeft, durationSecs, lastLoggedSecsRef.current, null);
  };
  
  const handleReset = () => {
    targetEndTimeRef.current = null;
    isRunningRef.current = false;
    setIsRunning(false);
    setRemainingSecs(durationSecs);
    remainingSecsRef.current = durationSecs;
    setInputValue(formatTime(durationSecs));
    lastLoggedSecsRef.current = 0;

    if (!swIsRunningRef.current) {
      workerRef.current?.postMessage('STOP');
      releaseWakeLock();
    }
    clearServerTimer();
    saveCountdownState(false, durationSecs, durationSecs, 0, null);
  };

  // Stopwatch Handlers
  const handleSwStart = () => {
    swStartTimeRef.current = Date.now();
    swIsRunningRef.current = true;
    setSwIsRunning(true);
    workerRef.current?.postMessage('START');
    requestWakeLock();
    saveSwState(true, swAccumulatedRef.current, swStartTimeRef.current, swLaps);
  };

  const handleSwPause = () => {
    swAccumulatedRef.current += Date.now() - swStartTimeRef.current;
    swIsRunningRef.current = false;
    setSwIsRunning(false);
    if (!isRunningRef.current) {
      workerRef.current?.postMessage('STOP');
      releaseWakeLock();
    }
    saveSwState(false, swAccumulatedRef.current, 0, swLaps);
  };

  const handleSwReset = () => {
    swAccumulatedRef.current = 0;
    swIsRunningRef.current = false;
    setSwIsRunning(false);
    setSwTime(0);
    setSwLaps([]);
    if (!isRunningRef.current) {
      workerRef.current?.postMessage('STOP');
      releaseWakeLock();
    }
    saveSwState(false, 0, 0, []);
  };

  const handleSwLap = () => {
    const currentLapTime = swAccumulatedRef.current + (Date.now() - swStartTimeRef.current);
    setSwLaps(prev => {
      const nextLaps = [...prev, currentLapTime];
      saveSwState(swIsRunningRef.current, swAccumulatedRef.current, swStartTimeRef.current, nextLaps);
      return nextLaps;
    });
  };

  const formatSwTime = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const c = Math.floor((ms % 1000) / 10);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${c.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'countdown' 
    ? (durationSecs > 0 ? Math.min(100, Math.max(0, ((durationSecs - remainingSecs) / durationSecs) * 100)) : 0)
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
    <div className="min-h-screen w-full max-w-3xl mx-auto px-4 flex flex-col justify-center pb-28 pt-8">
      <div className="w-full">
        <header className="mb-6 p-4 rounded-2xl bg-white/40 dark:bg-black/30 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Timer</h1>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-7 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center w-full">
          
          {!isRunning && !swIsRunning ? (
            <div className="relative w-full mb-4" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-medium text-sm flex items-center justify-between transition-colors focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {selectedHabit ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-md" style={{ color: selectedHabit.color }}>
                      {getIcon(selectedHabit.icon)}
                    </span>
                    <span>{selectedHabit.name}</span>
                  </div>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400">Select a habit...</span>
                )}
                <svg className={cn("w-4 h-4 text-gray-500 transition-transform", isDropdownOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => {
                      setActiveHabitId(null);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                  >
                    No habit selected
                  </button>
                  {habits.map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        setActiveHabitId(h.id);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium flex items-center gap-2 transition-colors border-t border-gray-100 dark:border-gray-700"
                    >
                      <span className="flex items-center justify-center w-5 h-5 rounded-md" style={{ color: h.color }}>
                        {getIcon(h.icon)}
                      </span>
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : selectedHabit ? (
            <div className="flex items-center gap-2 mb-4 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-xl text-gray-900 dark:text-white font-medium text-sm">
              <span className="flex items-center justify-center w-6 h-6 rounded-md" style={{ color: selectedHabit.color }}>
                {getIcon(selectedHabit.icon)}
              </span>
              <span>{selectedHabit.name}</span>
            </div>
          ) : (
             <div className="mb-4 text-gray-500 text-sm font-medium">Focus Session</div>
          )}

          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
            <button 
              onClick={() => { 
                if (mode !== 'countdown') {
                  setMode('countdown'); 
                  setRemainingSecs(durationSecs); 
                  setIsRunning(false);
                }
              }}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", mode === 'countdown' ? "bg-white dark:bg-gray-700 shadow flex items-center gap-1.5 text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-white")}
            >
              Countdown
            </button>
            <button 
              onClick={() => { 
                if (mode !== 'stopwatch') {
                  setMode('stopwatch'); 
                  setRemainingSecs(0); 
                  setIsRunning(false);
                }
              }}
              className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-colors", mode === 'stopwatch' ? "bg-white dark:bg-gray-700 shadow flex items-center gap-1.5 text-gray-900 dark:text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-white")}
            >
              Stopwatch
            </button>
          </div>

          <div className="relative w-72 h-72 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] mb-6 flex items-center justify-center">
            {/* SVG Ring */}
            {mode === 'countdown' && (
              <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-gray-100 dark:stroke-gray-800" />
                <circle 
                  cx="50" cy="50" r="45" fill="none" strokeWidth="4" 
                  className="stroke-indigo-500 transition-all duration-300 ease-linear"
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
                      maxLength={30}
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
                          durationSecsRef.current = secs;
                          setRemainingSecs(secs);
                          remainingSecsRef.current = secs;
                          setInputValue(formatTime(secs));
                        } else {
                          setInputValue(formatTime(durationSecs));
                        }
                      }}
                      className="w-full bg-transparent text-center border-b-2 border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:outline-none text-5xl md:text-7xl lg:text-8xl font-mono tabular-nums tracking-tighter text-gray-900 dark:text-white"
                      style={{ MozAppearance: 'textfield' }}
                    />
                    <div className="flex gap-1 mt-4">
                      <button onClick={() => {setDurationSecs(5*60); durationSecsRef.current = 5*60; setRemainingSecs(5*60); remainingSecsRef.current = 5*60; setInputValue(formatTime(5*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">5m</button>
                      <button onClick={() => {setDurationSecs(10*60); durationSecsRef.current = 10*60; setRemainingSecs(10*60); remainingSecsRef.current = 10*60; setInputValue(formatTime(10*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">10m</button>
                      <button onClick={() => {setDurationSecs(30*60); durationSecsRef.current = 30*60; setRemainingSecs(30*60); remainingSecsRef.current = 30*60; setInputValue(formatTime(30*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">30m</button>
                      <button onClick={() => {setDurationSecs(60*60); durationSecsRef.current = 60*60; setRemainingSecs(60*60); remainingSecsRef.current = 60*60; setInputValue(formatTime(60*60));}} className="text-[11px] uppercase font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md">1hr</button>
                    </div>
                  </div>
                ) : (
                  <span className="text-5xl md:text-7xl lg:text-8xl font-mono tabular-nums tracking-tighter text-gray-900 dark:text-white mb-2">
                    {formatTime(remainingSecs)}
                  </span>
                )
              ) : (
                <span className="text-5xl md:text-7xl lg:text-8xl font-mono tabular-nums tracking-tighter text-gray-900 dark:text-white mb-2 ml-2">
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
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
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
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
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
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 transition-colors"
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
