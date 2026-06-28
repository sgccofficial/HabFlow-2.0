import React from 'react';
import { useAppContext } from '../store/AppContext';
import { CheckCircle2, Timer, BookOpen, PieChart, Users } from 'lucide-react';
import { cn } from '../lib/utils';

export function BottomNav() {
  const { currentPage, setCurrentPage } = useAppContext();

  const navItems = [
    { id: 'habits', label: 'Habits', icon: CheckCircle2 },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'timer', label: 'Timer', icon: Timer },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive 
                  ? "text-indigo-600 dark:text-indigo-400" 
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
