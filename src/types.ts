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
}

export interface JournalEntry {
  id: string;
  habitId: string; // the habit this entry is linked to
  date: string; // ISO format "YYYY-MM-DD"
  content: string;
}

export interface JournalSettings {
  color?: string;
  texture?: string;
  isRandomBackground?: boolean;
}

export type Page = 'habits' | 'timer' | 'journal' | 'analytics';
