export interface HabitScheduleEntry {
  effectiveFrom: string; // ISO format "YYYY-MM-DD"
  targetDays: number[]; // 0=Sun, 1=Mon... 6=Sat
  dailyCompletions?: number;
  durationGoal?: number; // in seconds
  goalType?: 'daily' | 'weekly' | 'duration';
  goalValue?: number;
  reminderTime?: string;
}

export interface Habit {
  id: string;
  name: string;
  created: string; // ISO format "YYYY-MM-DD"
  dates: string[]; // ISO format "YYYY-MM-DD" for completed days
  progress?: Record<string, number>; // ISO format "YYYY-MM-DD" -> amount
  color: string;
  icon: string; // string name for lucide icon
  reminderTime: string; // "HH:mm"
  goalType?: 'daily' | 'weekly' | 'duration';
  goalValue?: number;
  durationUnit?: 'sec' | 'min' | 'hr';
  targetDays?: number[]; // 0=Sun, 1=Mon... 6=Sat
  dailyCompletions?: number;
  durationGoal?: number; // in seconds
  category?: string;
  isFrozen?: boolean;
  frozenSince?: string;
  frozenDates?: string[]; // ISO format "YYYY-MM-DD"
  scheduleHistory?: HabitScheduleEntry[];
  legacyStreak?: number;
  legacyStreakDate?: string;
  legacyLongestStreak?: number;
}

export interface JournalEntry {
  id: string;
  habitId: string; // the habit this entry is linked to
  date: string; // ISO format "YYYY-MM-DD"
  content: string;
  createdAt?: number;
}

export interface JournalSettings {
  color?: string;
  texture?: string;
  isRandomBackground?: boolean;
  aiAnalysisEnabled?: boolean;
}

export type Page = 'habits' | 'timer' | 'journal' | 'analytics';
