import fs from 'fs';
// get exactly the utils logic
const code = fs.readFileSync('./src/lib/utils.ts', 'utf-8');

// let's manually write what would happen in HabitPage.tsx and AnalyticsPage.tsx
const today = new Date();
const todayStr = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('-');
const todayDayOfWeek = today.getDay();

// A habit frozen yesterday
const habit = {
    id: '1',
    isFrozen: true,
    frozenSince: '2026-09-02',
    frozenDates: [],
    targetDays: [0, 1, 2, 3, 4, 5, 6]
};

// User unfreezes it today
const newFrozenDates = new Set(habit.frozenDates || []);
if (habit.frozenSince) {
    const [y, m, d] = habit.frozenSince.split('-');
    let curr = new Date(Number(y), Number(m)-1, Number(d));
    const [ty, tm, td] = todayStr.split('-');
    const end = new Date(Number(ty), Number(tm)-1, Number(td));
    curr.setHours(0,0,0,0);
    end.setHours(0,0,0,0);
    while (curr < end) {
        function formatDate(date) {
            const d = new Date(date);
            let month = '' + (d.getMonth() + 1);
            let day = '' + d.getDate();
            const year = d.getFullYear();
            if (month.length < 2) month = '0' + month;
            if (day.length < 2) day = '0' + day;
            return [year, month, day].join('-');
        }
        newFrozenDates.add(formatDate(curr));
        curr.setDate(curr.getDate() + 1);
    }
}
newFrozenDates.delete(todayStr); // Ensure today is not frozen when unfreezing

const updatedHabit = {
    ...habit,
    isFrozen: false,
    frozenSince: null,
    frozenDates: Array.from(newFrozenDates)
};

console.log("Updated Habit:", updatedHabit);

function isHabitDayFrozen(habit, dStr, todayStr) {
  if (!habit.isFrozen && dStr === todayStr) {
    return false; // Guarantee that if a habit is unfrozen, today is definitely unfrozen
  }
  
  if (habit.frozenDates?.includes(dStr)) return true;
  if (habit.isFrozen && habit.frozenSince) {
    if (dStr >= habit.frozenSince && dStr <= todayStr) {
      return true;
    }
  }
  return false;
}

const isFrozen = isHabitDayFrozen(updatedHabit, todayStr, todayStr);
console.log("isFrozen today:", isFrozen);
