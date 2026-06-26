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
  const { toggleHabitDate, updateHabitProgress, setCurrentPage, setActiveHabitId } = useAppContext();
  const todayStr = formatDate(new Date());
  
  const isCompletedToday = habit.dates.includes(todayStr);
  const streak = calculateStreak(habit);
  const todayProgress = habit.progress?.[todayStr] || 0;
  
  const isTimely = habit.durationGoal !== undefined ? habit.durationGoal > 0 : habit.goalType === 'duration';
  const durationGoal = habit.durationGoal || (habit.goalType === 'duration' ? (habit.durationUnit === 'hr' ? (habit.goalValue || 0) * 3600 : habit.durationUnit === 'min' ? (habit.goalValue || 0) * 60 : (habit.goalValue || 0)) : 0);
  
  const isDaily = habit.dailyCompletions !== undefined ? habit.dailyCompletions > 0 : (habit.goalType === 'daily' || habit.goalType === 'weekly');
  const dailyCompletions = habit.dailyCompletions || ((habit.goalType === 'daily' || habit.goalType === 'weekly') ? habit.goalValue || 1 : 1);

  const totalDurationGoal = isTimely ? durationGoal * (isDaily ? dailyCompletions : 1) : 0;

  const formatDuration = (secs: number) => {
    if (secs >= 3600) return `${Number((secs / 3600).toFixed(1))}h`;
    if (secs >= 60) return `${Number((secs / 60).toFixed(1))}m`;
    return `${secs}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-3 transition-all hover:shadow-md">
      <div 
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white"
        style={{ backgroundColor: habit.color }}
      >
        {getIcon(habit.icon)}
      </div>
      
      <div className="flex-grow min-w-0 cursor-pointer" onClick={onOpenCalendar} role="button">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{habit.name}</h3>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          <span className="whitespace-nowrap flex items-center">🔥 {streak} {streak === 1 ? 'day streak' : 'day streak'}</span>
          {habit.reminderTime && (
            <span className="flex items-center gap-0.5 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">
              <LucideIcons.Bell className="w-3 h-3" />
              {habit.reminderTime}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Edit habit"
        >
          <LucideIcons.Settings className="w-5 h-5" />
        </button>
        
        {isTimely && totalDurationGoal > 0 ? (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-1 border border-gray-200 dark:border-gray-600">
             <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1 whitespace-nowrap">
               {formatDuration(todayProgress)}/{formatDuration(totalDurationGoal)}
             </span>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setActiveHabitId(habit.id);
                 setCurrentPage('timer');
               }}
               className="w-7 h-7 bg-white dark:bg-gray-600 rounded-full flex items-center justify-center shadow-sm text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform"
             >
               <LucideIcons.Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
             </button>
          </div>
        ) : isDaily && dailyCompletions > 1 ? (
          todayProgress >= dailyCompletions ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateHabitProgress(habit.id, todayStr, -todayProgress);
              }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                "bg-green-500 text-white shadow-md shadow-green-500/20"
              )}
            >
              <LucideIcons.Check className="w-6 h-6" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-1 border border-gray-200 dark:border-gray-600">
               <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
                 {todayProgress}/{dailyCompletions}
               </span>
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   updateHabitProgress(habit.id, todayStr, 1);
                 }}
                 className="w-7 h-7 bg-white dark:bg-gray-600 rounded-full flex items-center justify-center shadow-sm text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-transform"
               >
                 <LucideIcons.Plus className="w-4 h-4" />
               </button>
            </div>
          )
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleHabitDate(habit.id, todayStr);
            }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              isCompletedToday 
                ? "bg-green-500 text-white shadow-md shadow-green-500/20" 
                : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            )}
            aria-label={isCompletedToday ? "Mark uncompleted" : "Mark completed"}
          >
            <LucideIcons.Check className="w-6 h-6" strokeWidth={isCompletedToday ? 3 : 2} />
          </button>
        )}
      </div>
    </div>
  );
}
