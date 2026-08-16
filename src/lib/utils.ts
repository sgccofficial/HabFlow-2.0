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

export function getHabitTargetValue(habit: Habit): number {
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
  return targetValue;
}

export function getHabitProgressValue(habit: Habit, dStr: string): number {
  return habit.progress?.[dStr] ?? (habit.dates.includes(dStr) ? getHabitTargetValue(habit) : 0);
}

export function checkDayStatus(habit: Habit, dStr: string): 'completed' | 'partial' | 'none' {
  const val = getHabitProgressValue(habit, dStr);
  if (val === 0) return 'none';
  const targetValue = getHabitTargetValue(habit);
  
  return val >= targetValue ? 'completed' : 'partial';
}

export function calculateStreak(habit: Habit): number {
  const { created, targetDays: savedTargetDays } = habit;
  const targetDays = savedTargetDays || [0, 1, 2, 3, 4, 5, 6];
  if (targetDays.length === 0) return 0;

  let streak = 0;
  let current = new Date();
  const todayStr = formatDate(current);

  while (true) {
    const dStr = formatDate(current);
    if (dStr < created) break;

    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);
    const dayOfWeek = current.getDay();
    const isTargetDay = targetDays.includes(dayOfWeek);
    const status = checkDayStatus(habit, dStr);

    if (status === 'completed') {
      if (!isFrozen) {
        streak++;
      }
    } else {
      if (!isFrozen) {
        if (isTargetDay) {
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
  const { created, targetDays: savedTargetDays } = habit;
  const targetDays = savedTargetDays || [0, 1, 2, 3, 4, 5, 6];
  if (targetDays.length === 0) return 0;

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
      const status = checkDayStatus(habit, dStr);
      
      if (status === 'completed') {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (isTarget) {
        tempStreak = 0;
      }
    }
  }
  return longestStreak;
}
