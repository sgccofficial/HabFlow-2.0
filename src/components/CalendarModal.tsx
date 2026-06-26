import React, { useState } from 'react';
import { Habit } from '../types';
import { useAppContext } from '../store/AppContext';
import { X, ChevronLeft, ChevronRight, Timer, BookOpen, PieChart } from 'lucide-react';
import { formatDate, calculateStreak, cn } from '../lib/utils';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, addMonths, subMonths, isAfter, isBefore } from 'date-fns';

interface CalendarModalProps {
  habit: Habit;
  onClose: () => void;
}

export function CalendarModal({ habit, onClose }: CalendarModalProps) {
  const { setCurrentPage, setActiveHabitId } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const todayStr = formatDate(new Date());
  const todayDate = new Date();
  
  // Calculate days for the grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  
  // padding for calendar grid
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // start from sunday
  
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // end on saturday
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  
  const streak = calculateStreak(habit);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => {
    if (!isSameMonth(currentMonth, todayDate) && isBefore(currentMonth, todayDate)) {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const handleShortcut = (page: 'timer' | 'journal' | 'analytics') => {
    setActiveHabitId(habit.id);
    setCurrentPage(page);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{habit.name}</h2>
            <p className="text-sm text-gray-500 font-medium tracking-tight">Current Streak: <span className="text-orange-500">🔥 {streak}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{format(currentMonth, 'MMMM yyyy')}</h3>
            <button 
              onClick={nextMonth} 
              disabled={isSameMonth(currentMonth, todayDate)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-xs font-medium text-gray-400">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dStr = formatDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isFuture = dStr > todayStr;
              const isBeforeCreated = dStr < habit.created;
              const isCompleted = habit.dates.includes(dStr);
              
              let bgColor = "";
              let textColor = isCurrentMonth ? "text-gray-900 dark:text-gray-100" : "text-gray-300 dark:text-gray-600";
              
              if (isCurrentMonth) {
                if (isCompleted) {
                  bgColor = "bg-green-100 dark:bg-green-900/40";
                  textColor = "text-green-700 dark:text-green-400 font-bold";
                } else if (!isFuture && !isBeforeCreated) {
                  const dayOfWeek = day.getDay();
                  const isTargetDay = habit.targetDays ? habit.targetDays.includes(dayOfWeek) : true;
                  if (isTargetDay) {
                    bgColor = "bg-red-50 dark:bg-red-900/20";
                    textColor = "text-red-500 dark:text-red-400";
                  }
                }
              }

              return (
                <div 
                  key={day.toISOString()}
                  className={cn(
                    "aspect-square flex items-center justify-center text-sm rounded-lg",
                    bgColor,
                    textColor,
                    (!isCurrentMonth || isFuture || isBeforeCreated) && "opacity-50"
                  )}
                >
                  {format(day, 'd')}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex gap-2">
          <button
            onClick={() => handleShortcut('timer')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <Timer className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-medium dark:text-gray-200">Timer</span>
          </button>
          <button
            onClick={() => handleShortcut('journal')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-medium dark:text-gray-200">Journal</span>
          </button>
          <button
            onClick={() => handleShortcut('analytics')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <PieChart className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] font-medium dark:text-gray-200">Stats</span>
          </button>
        </div>
      </div>
    </div>
  );
}
