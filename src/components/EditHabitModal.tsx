import React, { useState } from 'react';
import { Habit } from '../types';
import { useAppContext } from '../store/AppContext';
import { X, Trash2 } from 'lucide-react';
import { getIcon } from './HabitCard';
import { cn } from '../lib/utils';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'
];
const ICONS = ['Activity', 'Book', 'Code', 'Dumbbell', 'Coffee', 'Heart', 'Music', 'Droplets', 'Sun', 'Moon', 'Gamepad', 'Headphones'];

interface EditModalProps {
  habit: Habit;
  onClose: () => void;
}

export function EditHabitModal({ habit, onClose }: EditModalProps) {
  const { updateHabit, deleteHabit } = useAppContext();
  
  const [name, setName] = useState(habit.name);
  const [showNameError, setShowNameError] = useState(false);
  const [color, setColor] = useState(habit.color);
  const [icon, setIcon] = useState(habit.icon);
  const [reminderTime, setReminderTime] = useState(habit.reminderTime);
  const [hasDaily, setHasDaily] = useState(habit.dailyCompletions !== undefined ? habit.dailyCompletions > 0 : (habit.goalType === 'daily' || habit.goalType === 'weekly'));
  const [dailyCompletions, setDailyCompletions] = useState<number>(habit.dailyCompletions || ((habit.goalType === 'daily' || habit.goalType === 'weekly') ? habit.goalValue || 1 : 1));

  const [hasWeekly, setHasWeekly] = useState(habit.targetDays ? habit.targetDays.length < 7 : habit.goalType === 'weekly');
  const [targetDays, setTargetDays] = useState<number[]>(habit.targetDays || [0, 1, 2, 3, 4, 5, 6]);

  const [hasTimely, setHasTimely] = useState(habit.durationGoal !== undefined ? habit.durationGoal > 0 : habit.goalType === 'duration');
  
  const initialDuration = habit.durationGoal || (habit.goalType === 'duration' ? (habit.durationUnit === 'hr' ? (habit.goalValue || 0) * 3600 : habit.durationUnit === 'min' ? (habit.goalValue || 0) * 60 : (habit.goalValue || 0)) : 0);

  const [durationHours, setDurationHours] = useState(() => Math.floor(initialDuration / 3600));
  const [durationMinutes, setDurationMinutes] = useState(() => Math.floor((initialDuration % 3600) / 60) || (initialDuration === 0 ? 15 : 0));
  const [durationSeconds, setDurationSeconds] = useState(() => initialDuration % 60);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      setShowNameError(true);
      return;
    }
    
    let finalDailyCompletions = hasDaily ? dailyCompletions : 0;
    let finalDurationGoal = hasTimely ? (durationHours * 3600 + durationMinutes * 60 + durationSeconds) : 0;
    let finalTargetDays = hasWeekly ? targetDays : [0, 1, 2, 3, 4, 5, 6];

    let fallbackGoalType: Habit['goalType'] = 'daily';
    let fallbackGoalValue = 1;
    let fallbackDurationUnit: Habit['durationUnit'] = 'sec';

    if (hasTimely) {
      fallbackGoalType = 'duration';
      fallbackGoalValue = finalDurationGoal;
    } else if (hasWeekly) {
      fallbackGoalType = 'weekly';
      fallbackGoalValue = finalDailyCompletions;
    } else if (hasDaily) {
      fallbackGoalType = 'daily';
      fallbackGoalValue = finalDailyCompletions;
    }
    
    updateHabit(habit.id, { 
      name: name.trim(), 
      category: habit.category || '',
      color, 
      icon, 
      reminderTime, 
      goalType: fallbackGoalType, 
      goalValue: fallbackGoalValue, 
      durationUnit: fallbackDurationUnit,
      targetDays: finalTargetDays,
      dailyCompletions: finalDailyCompletions,
      durationGoal: finalDurationGoal
    });
    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteHabit(habit.id);
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: color }}>
              {getIcon(icon)}
            </span>
            Customize
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input 
              type="text" 
              maxLength={30}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (showNameError) setShowNameError(false);
              }}
              className={cn(
                "w-full px-3 py-2 border rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white transition-colors",
                showNameError 
                  ? "border-red-500 dark:border-red-500 focus:ring-1 focus:ring-red-500 focus:border-red-500" 
                  : "dark:border-gray-700 focus:ring-1 focus:ring-indigo-500"
              )}
            />
            {showNameError && (
              <p className="mt-1.5 text-sm text-red-500 font-medium">A name is needed</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-10 h-10 rounded-full",
                    color === c ? "ring-2 ring-offset-2 dark:ring-offset-gray-900 ring-gray-900 dark:ring-gray-100" : ""
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icon</label>
            <div className="grid grid-cols-6 gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={cn(
                    "aspect-square rounded-xl flex items-center justify-center transition-colors",
                    icon === i 
                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400" 
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                  )}
                >
                  {getIcon(i)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Goal Settings</label>
            <div className={cn("flex gap-2 mb-6", habit.isFrozen && "opacity-50 pointer-events-none")}>
              <button
                type="button"
                onClick={() => setHasDaily(!hasDaily)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium transition-colors border",
                  hasDaily
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                    : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setHasWeekly(!hasWeekly)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium transition-colors border",
                  hasWeekly
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                    : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                )}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setHasTimely(!hasTimely)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium transition-colors border",
                  hasTimely
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                    : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                )}
              >
                Timely
              </button>
            </div>

            {hasWeekly && (
              <div className={cn("mb-6 animate-in slide-in-from-top-2", habit.isFrozen && "opacity-50 pointer-events-none")}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat On</label>
                <div className="flex items-center gap-1.5 w-full justify-between">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (targetDays.includes(idx)) {
                          if (targetDays.length > 1) {
                            setTargetDays(targetDays.filter(d => d !== idx));
                          }
                        } else {
                          setTargetDays([...targetDays, idx].sort());
                        }
                      }}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors border",
                        targetDays.includes(idx)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasDaily && (
              <div className={cn("flex items-center gap-3 mb-6 animate-in slide-in-from-top-2", habit.isFrozen && "opacity-50 pointer-events-none")}>
                <span className="text-sm text-gray-500 dark:text-gray-400">Completions:</span>
                <div className="flex items-center">
                  <button 
                    type="button"
                    onClick={() => setDailyCompletions(Math.max(1, dailyCompletions - 1))}
                    className="w-8 h-8 rounded-l-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                  >-</button>
                  <div className="w-12 h-8 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border-y dark:border-gray-700 font-medium text-gray-900 dark:text-white">
                    {dailyCompletions}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setDailyCompletions(dailyCompletions + 1)}
                    className="w-8 h-8 rounded-r-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300"
                  >+</button>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {dailyCompletions === 1 ? 'time/day' : 'times/day'}
                </span>
              </div>
            )}

            {hasTimely && (
              <div className={cn("mb-6 animate-in slide-in-from-top-2", habit.isFrozen && "opacity-50 pointer-events-none")}>
                <span className="block text-sm text-gray-500 dark:text-gray-400 mb-2">Time Target:</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={durationHours || ''}
                      onChange={(e) => setDurationHours(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-16 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">hr</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationMinutes || ''}
                      onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      placeholder="0"
                      className="w-16 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={durationSeconds || ''}
                      onChange={(e) => setDurationSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      placeholder="0"
                      className="w-16 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">sec</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { setDurationHours(0); setDurationMinutes(0); setDurationSeconds(0); }} 
                    className="self-start text-xs font-medium px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={cn(habit.isFrozen && "opacity-50 pointer-events-none")}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Reminder</label>
              <button
                type="button"
                onClick={() => {
                  if (reminderTime) {
                    setReminderTime('');
                  } else {
                    setReminderTime('09:00');
                    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                      Notification.requestPermission();
                    }
                  }
                }}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  reminderTime ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"
                )}
              >
                <span 
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    reminderTime ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            {reminderTime && (
              <input 
                type="time" 
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button
            onClick={handleDelete}
            className={cn(
              "p-3 rounded-xl transition-colors font-medium flex items-center justify-center min-w-[3rem]",
              showDeleteConfirm 
                ? "bg-red-600 text-white hover:bg-red-700 flex-1" 
                : "text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40"
            )}
            title="Delete Habit"
          >
            {showDeleteConfirm ? "Tap again to delete" : <Trash2 className="w-5 h-5" />}
          </button>
          {!showDeleteConfirm && (
            <button
              onClick={handleSave}
              className="flex-grow bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 font-medium py-3 rounded-xl transition-colors"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
