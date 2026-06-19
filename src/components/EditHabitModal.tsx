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
  const [color, setColor] = useState(habit.color);
  const [icon, setIcon] = useState(habit.icon);
  const [reminderTime, setReminderTime] = useState(habit.reminderTime);

  const handleSave = () => {
    if (!name.trim()) return;
    updateHabit(habit.id, { name: name.trim(), color, icon, reminderTime });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Delete this habit and all its history?')) {
      deleteHabit(habit.id);
      onClose();
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
              maxLength={25}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
            />
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
            className="p-3 text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors"
            title="Delete Habit"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            className="flex-grow bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 font-medium py-3 rounded-xl transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
