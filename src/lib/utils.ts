import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Habit } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format Date to YYYY-MM-DD
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7; // Get current day number, converting Sun. to 7
  if (day !== 1) d.setHours(-24 * (day - 1)); // Set to previous Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isHabitDayFrozen(habit: Habit, dStr: string, todayStr: string): boolean {
  if (habit.frozenDates?.includes(dStr)) return true;
  if (habit.isFrozen && habit.frozenSince) {
    if (dStr >= habit.frozenSince && dStr <= todayStr) {
      return true;
    }
  }
  return false;
}

// Calculate streak
export function calculateStreak(habit: Habit): number {
  const { created, dates, progress, targetDays: savedTargetDays } = habit;
  
  if (dates.length === 0 && (!progress || Object.keys(progress).length === 0)) return 0;
  
  const isTimely = habit.durationGoal !== undefined ? habit.durationGoal > 0 : habit.goalType === 'duration';
  const durationGoal = habit.durationGoal || (habit.goalType === 'duration' ? (habit.durationUnit === 'hr' ? (habit.goalValue || 0) * 3600 : habit.durationUnit === 'min' ? (habit.goalValue || 0) * 60 : (habit.goalValue || 0)) : 0);
  
  const isDaily = habit.dailyCompletions !== undefined ? habit.dailyCompletions > 0 : (habit.goalType === 'daily' || habit.goalType === 'weekly');
  const dailyCompletions = habit.dailyCompletions || ((habit.goalType === 'daily' || habit.goalType === 'weekly') ? habit.goalValue || 1 : 1);

  let targetValue = 1;
  if (isTimely) {
    targetValue = durationGoal * (isDaily ? dailyCompletions : 1);
  } else if (isDaily) {
    targetValue = dailyCompletions;
  }
  
  const checkDayCompleted = (dStr: string) => {
    const val = progress?.[dStr] ?? (dates.includes(dStr) ? 1 : 0);
    const dateObj = new Date(dStr + 'T12:00:00');
    if (!targetDays.includes(dateObj.getDay())) {
      return val > 0;
    }
    return val >= targetValue;
  };

  const targetDays = savedTargetDays || [0, 1, 2, 3, 4, 5, 6];
  if (targetDays.length === 0) return 0;

  let streak = 0;
  let current = new Date();
  const todayStr = formatDate(current);

  while (true) {
    const dStr = formatDate(current);
    if (dStr < created) break;

    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);

    if (checkDayCompleted(dStr)) {
      if (!isFrozen) {
        streak++;
      }
    } else {
      if (!isFrozen) {
        const dayOfWeek = current.getDay();
        if (targetDays.includes(dayOfWeek)) {
          if (dStr !== todayStr) {
            break; // Past required day missed -> streak broken
          }
        }
      }
    }
    
    current.setDate(current.getDate() - 1);
  }
  return streak;
}

export function calculateLongestStreak(habit: Habit): number {
  const { created, dates, progress, targetDays: savedTargetDays } = habit;
  
  if (dates.length === 0 && (!progress || Object.keys(progress).length === 0)) return 0;
  
  const isTimely = habit.durationGoal !== undefined ? habit.durationGoal > 0 : habit.goalType === 'duration';
  const durationGoal = habit.durationGoal || (habit.goalType === 'duration' ? (habit.durationUnit === 'hr' ? (habit.goalValue || 0) * 3600 : habit.durationUnit === 'min' ? (habit.goalValue || 0) * 60 : (habit.goalValue || 0)) : 0);
  
  const isDaily = habit.dailyCompletions !== undefined ? habit.dailyCompletions > 0 : (habit.goalType === 'daily' || habit.goalType === 'weekly');
  const dailyCompletions = habit.dailyCompletions || ((habit.goalType === 'daily' || habit.goalType === 'weekly') ? habit.goalValue || 1 : 1);

  let targetValue = 1;
  if (isTimely) {
    targetValue = durationGoal * (isDaily ? dailyCompletions : 1);
  } else if (isDaily) {
    targetValue = dailyCompletions;
  }
  
  const targetDays = savedTargetDays || [0, 1, 2, 3, 4, 5, 6];
  if (targetDays.length === 0) return 0;

  const checkDayCompleted = (dStr: string) => {
    const val = progress?.[dStr] ?? (dates.includes(dStr) ? 1 : 0);
    const dateObj = new Date(dStr + 'T12:00:00');
    if (!targetDays.includes(dateObj.getDay())) {
      return val > 0;
    }
    return val >= targetValue;
  };

  let longestStreak = 0;
  let tempStreak = 0;
  const today = new Date();
  const todayStr = formatDate(today);
  
  const createdDate = new Date(created + 'T12:00:00');
  const daysSinceCreation = Math.max(1, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  for (let i = 0; i < daysSinceCreation; i++) {
    const d = new Date(createdDate);
    d.setDate(d.getDate() + i);
    const dStr = formatDate(d);
    
    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);
    
    if (!isFrozen) {
      const dayOfWeek = d.getDay();
      const isTarget = targetDays.includes(dayOfWeek);
      
      if (checkDayCompleted(dStr)) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (isTarget) {
        tempStreak = 0;
      }
    }
  }
  
  return longestStreak;
}
