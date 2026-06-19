export interface Habit {
  id: string;
  name: string;
  created: string; // ISO format "YYYY-MM-DD"
  dates: string[]; // ISO format "YYYY-MM-DD" for completed days
  color: string;
  icon: string; // string name for lucide icon
  reminderTime: string; // "HH:mm"
}

export interface JournalEntry {
  id: string;
  habitId: string; // the habit this entry is linked to
  date: string; // ISO format "YYYY-MM-DD"
  content: string;
}

export type Page = 'habits' | 'timer' | 'journal';
