import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

// Calculate streak
export function calculateStreak(created: string, dates: string[]): number {
  if (dates.length === 0) return 0;
  
  const completed = new Set(dates);
  let current = new Date();
  
  // Set to local date string to avoid timezone issues 10pm vs 2am
  const todayStr = formatDate(current);
  
  let streak = 0;
  
  // If today is completed, start from today. Else start from yesterday.
  if (completed.has(todayStr)) {
    streak = 1;
  }
  
  // Track backwards
  current.setDate(current.getDate() - (streak === 1 ? 1 : 0));
  
  while (true) {
    const dStr = formatDate(current);
    if (dStr < created) break; // Before habit existed
    
    if (completed.has(dStr)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      // Break the chain if we missed a day. 
      // If today wasn't completed, and we miss yesterday, streak is 0. 
      // But if we miss today, and yesterday was completed, the streak doesn't break until we check yesterday.
      // Wait, if today is not completed, we check yesterday. If yesterday is completed, streak = 1, current-=1.
      if (!completed.has(todayStr) && formatDate(current) === formatDate(new Date(Date.now() - 86400000))) {
         // It's yesterday. If yesterday is not completed, streak is 0.
         break;
      }
      break;
    }
  }
  return streak;
}
