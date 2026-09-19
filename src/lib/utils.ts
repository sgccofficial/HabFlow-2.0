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
  if (habit.isFrozen) {
    if (habit.frozenSince) {
      if (dStr >= habit.frozenSince && dStr <= todayStr) {
        return true;
      }
    } else {
      const dates = habit.dates || [];
      if (dates.length === 0) return true;
      const maxDate = dates.reduce((a, b) => a > b ? a : b);
      if (dStr > maxDate) return true;
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

export function getHabitScheduleForDate(habit: Habit, dateStr: string): {
  targetDays: number[];
  targetValue: number;
  dailyCompletions: number;
  durationGoal: number;
  reminderTime: string;
} {
  if (habit.scheduleHistory && habit.scheduleHistory.length > 0) {
    const sorted = [...habit.scheduleHistory].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    let matchedEntry = sorted[0];
    for (const entry of sorted) {
      if (entry.effectiveFrom <= dateStr) {
        matchedEntry = entry;
      } else {
        break;
      }
    }
    if (matchedEntry) {
      const targetDays = matchedEntry.targetDays && matchedEntry.targetDays.length > 0 
        ? matchedEntry.targetDays 
        : [0, 1, 2, 3, 4, 5, 6];
      const dailyCompletions = matchedEntry.dailyCompletions ?? 1;
      const durationGoal = matchedEntry.durationGoal ?? 0;
      let targetValue = 1;
      if (durationGoal > 0) {
        targetValue = durationGoal * (dailyCompletions > 0 ? dailyCompletions : 1);
      } else if (dailyCompletions > 0) {
        targetValue = dailyCompletions;
      }
      return {
        targetDays,
        targetValue,
        dailyCompletions,
        durationGoal,
        reminderTime: matchedEntry.reminderTime ?? habit.reminderTime ?? ''
      };
    }
  }

  const targetDays = habit.targetDays && habit.targetDays.length > 0 
    ? habit.targetDays 
    : [0, 1, 2, 3, 4, 5, 6];
  const targetValue = getHabitTargetValue(habit);
  return {
    targetDays,
    targetValue,
    dailyCompletions: habit.dailyCompletions ?? 1,
    durationGoal: habit.durationGoal ?? 0,
    reminderTime: habit.reminderTime ?? ''
  };
}

export function getHabitProgressValue(habit: Habit, dStr: string): number {
  return habit.progress?.[dStr] ?? (habit.dates.includes(dStr) ? getHabitScheduleForDate(habit, dStr).targetValue : 0);
}

export function checkDayStatus(habit: Habit, dStr: string): 'completed' | 'partial' | 'none' {
  if (habit.dates.includes(dStr)) return 'completed';
  
  const schedule = getHabitScheduleForDate(habit, dStr);
  const targetValue = schedule.targetValue;
  const val = habit.progress?.[dStr] || 0;

  if (val === 0) return 'none';
  return val >= targetValue ? 'completed' : 'partial';
}

export function calculateStreak(habit: Habit, endDateStr?: string): number {
  const { created, legacyStreak, legacyStreakDate } = habit;
  const todayStr = formatDate(new Date());

  let streak = 0;
  let current = endDateStr ? new Date(endDateStr + 'T12:00:00') : new Date();

  while (true) {
    const dStr = formatDate(current);

    if (!endDateStr && legacyStreakDate && dStr === legacyStreakDate && (!habit.scheduleHistory || habit.scheduleHistory.length <= 1)) {
      streak += (legacyStreak || 0);
      break;
    }

    if (!created || dStr < created) break;

    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);
    const schedule = getHabitScheduleForDate(habit, dStr);
    const targetDays = schedule.targetDays;
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

export function calculateLongestStreak(habit: Habit, endDateStr?: string): number {
  const { created, legacyLongestStreak } = habit;
  if (!created) return 0;

  let longestStreak = legacyLongestStreak || 0;
  let tempStreak = 0;
  
  const limitDate = endDateStr ? new Date(endDateStr + 'T12:00:00') : new Date();
  const todayStr = formatDate(new Date());

  const startDate = new Date(created + 'T12:00:00');
  const daysToCalculate = Math.max(0, Math.floor((limitDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  
  for (let i = 0; i < daysToCalculate; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dStr = formatDate(d);
    
    if (dStr > formatDate(limitDate)) break;
    
    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);
    
    if (!isFrozen) {
      const schedule = getHabitScheduleForDate(habit, dStr);
      const targetDays = schedule.targetDays;
      const dayOfWeek = d.getDay();
      const isTarget = targetDays.includes(dayOfWeek);
      const status = checkDayStatus(habit, dStr);
      
      if (status === 'completed') {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else if (isTarget) {
        if (dStr !== todayStr) {
          tempStreak = 0;
        }
      }
    }
  }

  return longestStreak;
}

export interface HabitConsistencyResult {
  consistencyRate: number;
  scheduledDays: number;
  completedDays: number;
}

/**
 * Calculates the consistency percentage for an individual habit.
 * - Evaluates scheduled target days from creation to today according to the schedule at the time.
 * - Properly excludes frozen days/periods.
 * - Today is considered "in progress" and does not penalize the user if not yet completed.
 * - Bonus completions on non-target days count towards consistency without exceeding 100%.
 * - If task is new, completely frozen, or has 0 current & longest streak, consistency is 0%.
 */
export function calculateHabitConsistency(habit: Habit, asOfDate: Date = new Date()): HabitConsistencyResult {
  const todayStr = formatDate(asOfDate);
  const createdStr = habit.created || todayStr;
  if (createdStr > todayStr) {
    return { consistencyRate: 0, scheduledDays: 0, completedDays: 0 };
  }

  const currentStreak = calculateStreak(habit, todayStr);
  const longestStreak = calculateLongestStreak(habit, todayStr);
  const hasAnyCompletions = habit.dates && habit.dates.length > 0;

  // New task or completely frozen task or no completions: 0% consistency
  if (currentStreak === 0 && longestStreak === 0 && !hasAnyCompletions) {
    return { consistencyRate: 0, scheduledDays: 0, completedDays: 0 };
  }

  let scheduledDays = 0;
  let completedDays = 0;
  let bonusCompletions = 0;

  const cur = new Date(createdStr + 'T12:00:00');
  const endDate = new Date(todayStr + 'T12:00:00');

  while (cur <= endDate) {
    const dStr = formatDate(cur);
    const dayOfWeek = cur.getDay();
    const schedule = getHabitScheduleForDate(habit, dStr);
    const targetDays = schedule.targetDays;
    const isTarget = targetDays.includes(dayOfWeek);
    const isFrozen = isHabitDayFrozen(habit, dStr, todayStr);
    const isCompleted = checkDayStatus(habit, dStr) === 'completed';

    if (!isFrozen) {
      if (dStr === todayStr) {
        // Today is currently in progress:
        // If completed, reward the user with +1 scheduled day and +1 completed day.
        // If not completed yet today, do not penalize as a missed day.
        if (isCompleted) {
          if (isTarget) {
            scheduledDays++;
            completedDays++;
          } else {
            bonusCompletions++;
          }
        }
      } else {
        // Past day:
        if (isTarget) {
          scheduledDays++;
          if (isCompleted) {
            completedDays++;
          }
        } else if (isCompleted) {
          bonusCompletions++;
        }
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  const totalCompletedCount = completedDays + bonusCompletions;

  if (scheduledDays === 0) {
    if (bonusCompletions > 0) {
      return { consistencyRate: 100, scheduledDays: bonusCompletions, completedDays: bonusCompletions };
    }
    return { consistencyRate: 0, scheduledDays: 0, completedDays: 0 };
  }

  const effectiveScheduledDays = Math.max(scheduledDays, totalCompletedCount);
  const totalCompleted = Math.min(effectiveScheduledDays, totalCompletedCount);
  const consistencyRate = Math.min(100, Math.max(0, Math.round((totalCompleted / scheduledDays) * 100)));

  return { consistencyRate, scheduledDays: effectiveScheduledDays, completedDays: totalCompleted };
}

/**
 * Calculates the overall statistics and consistency rate across active habits.
 */
export function calculateOverallStats(habits: Habit[], asOfDate: Date = new Date()) {
  const activeHabitsList = habits.filter(h => !h.isFrozen);
  let totalCompletions = 0;
  let totalPossible = 0;
  let allTimeCompletions = 0;
  const todayStr = formatDate(asOfDate);

  // All time completions across all habits
  habits.forEach(h => {
    let validComps = 0;
    const cur = new Date(h.created + 'T12:00:00');
    const endDate = new Date(todayStr + 'T12:00:00');
    while (cur <= endDate) {
      const ds = formatDate(cur);
      if (!isHabitDayFrozen(h, ds, todayStr) && checkDayStatus(h, ds) === 'completed') {
        validComps++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    if (h.legacyStreak && h.legacyStreakDate && (!h.scheduleHistory || h.scheduleHistory.length <= 1)) {
      validComps += Math.max(0, h.legacyStreak - 1);
    }
    allTimeCompletions += validComps;
  });

  // Calculate consistency across active habits
  activeHabitsList.forEach(h => {
    const res = calculateHabitConsistency(h, asOfDate);
    totalCompletions += res.completedDays;
    totalPossible += res.scheduledDays;
  });

  const consistencyRate = totalPossible > 0 
    ? Math.min(100, Math.max(0, Math.round((totalCompletions / totalPossible) * 100))) 
    : 0;

  return {
    totalCompletions,
    totalPossible,
    allTimeCompletions,
    activeHabits: activeHabitsList.length,
    consistencyRate
  };
}

