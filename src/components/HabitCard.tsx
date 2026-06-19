import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { Habit } from '../types';
import { formatDate, calculateStreak, cn } from '../lib/utils';
import * as LucideIcons from 'lucide-react';

interface HabitCardProps {
  habit: Habit;
  onEdit: () => void;
  onOpenCalendar: () => void;
}

// Helper to get lucide icon by name
export const getIcon = (name: string) => {
  const Icon = (LucideIcons as any)[name] || LucideIcons.CheckCircle;
  return <Icon className="w-5 h-5" />;
};

export function HabitCard({ habit, onEdit, onOpenCalendar }: HabitCardProps) {
  const { toggleHabitDate } = useAppContext();
  const todayStr = formatDate(new Date());
  const isCompletedToday = habit.dates.includes(todayStr);
  const streak = calculateStreak(habit.created, habit.dates);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 transition-all hover:shadow-md">
      <div 
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white"
        style={{ backgroundColor: habit.color }}
      >
        {getIcon(habit.icon)}
      </div>
      
      <div className="flex-grow min-w-0 cursor-pointer" onClick={onOpenCalendar} role="button">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{habit.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
          <span>🔥 {streak} {streak === 1 ? 'day' : 'days'} streak</span>
          {habit.reminderTime && (
            <span className="flex items-center gap-0.5 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 rounded-md">
              <LucideIcons.Bell className="w-3 h-3" />
              {habit.reminderTime}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Edit habit"
        >
          <LucideIcons.Settings className="w-5 h-5" />
        </button>
        <button
          onClick={() => toggleHabitDate(habit.id, todayStr)}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            isCompletedToday 
              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
          )}
          aria-label={isCompletedToday ? "Mark uncompleted" : "Mark completed"}
        >
          <LucideIcons.Check className="w-6 h-6" strokeWidth={isCompletedToday ? 3 : 2} />
        </button>
      </div>
    </div>
  );
}
