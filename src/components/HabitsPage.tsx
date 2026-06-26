import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { HabitCard } from './HabitCard';
import { Plus } from 'lucide-react';
import { CalendarModal } from './CalendarModal';
import { EditHabitModal } from './EditHabitModal';
import { Habit } from '../types';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899'
];
const ICONS = ['Activity', 'Book', 'Code', 'Dumbbell', 'Coffee', 'Heart', 'Music'];

export function HabitsPage() {
  const { habits, addHabit } = useAppContext();
  const [newHabitName, setNewHabitName] = useState('');
  
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [calendarHabit, setCalendarHabit] = useState<Habit | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    
    addHabit({
      name: newHabitName.trim(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      icon: ICONS[Math.floor(Math.random() * ICONS.length)],
      reminderTime: '09:00',
    });
    setNewHabitName('');
  };

  return (
    <div className="pb-24 pt-8 px-4">
      <div className="max-w-md mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">HabitFlow</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Build better habits, one step at a time.</p>
        </header>

        <form onSubmit={handleAdd} className="relative mb-8">
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            maxLength={25}
            placeholder="What do you want to build?"
            className="w-full pl-4 pr-12 py-4 rounded-2xl bg-white dark:bg-gray-800 border-none shadow-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white dark:placeholder-gray-500 font-medium"
          />
          <button
            type="submit"
            disabled={!newHabitName.trim()}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-3">
          {habits.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No habits yet.</p>
              <p className="text-sm">Add one to get started!</p>
            </div>
          ) : (
            habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onEdit={() => setEditingHabit(habit)}
                onOpenCalendar={() => setCalendarHabit(habit)}
              />
            ))
          )}
        </div>
      </div>

      {editingHabit && (
        <EditHabitModal 
          habit={editingHabit} 
          onClose={() => setEditingHabit(null)} 
        />
      )}

      {calendarHabit && (
        <CalendarModal 
          habit={calendarHabit} 
          onClose={() => setCalendarHabit(null)} 
        />
      )}
    </div>
  );
}
