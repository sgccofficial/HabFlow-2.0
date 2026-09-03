import { isHabitDayFrozen } from './src/lib/utils.js';

const today = new Date();
const todayStr = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('-');
const todayDayOfWeek = today.getDay();

const habits = [
  {
    id: '1',
    name: 'Habit 1',
    isFrozen: false,
    frozenSince: null,
    frozenDates: [],
    targetDays: [0, 1, 2, 3, 4, 5, 6]
  }
];

const todayScheduledHabits = habits.filter(h => {
  if (isHabitDayFrozen(h, todayStr, todayStr)) return false;
  const targetDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
  if (!targetDays.includes(todayDayOfWeek)) return false;
  return true;
});

console.log("todayScheduledHabits:", todayScheduledHabits);
