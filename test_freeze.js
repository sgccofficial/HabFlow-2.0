function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const todayStr = formatDate(new Date());

const habit = {
  id: "1",
  isFrozen: true,
  frozenSince: "2026-09-01",
  frozenDates: []
};

const newFrozenDates = new Set(habit.frozenDates || []);
if (habit.frozenSince) {
  const [y, m, d] = habit.frozenSince.split('-');
  let curr = new Date(Number(y), Number(m)-1, Number(d));
  const [ty, tm, td] = todayStr.split('-');
  const end = new Date(Number(ty), Number(tm)-1, Number(td));
  curr.setHours(0,0,0,0);
  end.setHours(0,0,0,0);
  while (curr < end) {
    newFrozenDates.add(formatDate(curr));
    curr.setDate(curr.getDate() + 1);
  }
}
newFrozenDates.delete(todayStr); // Ensure today is not frozen when unfreezing
console.log(Array.from(newFrozenDates));

const updatedHabit = { ...habit, isFrozen: false, frozenSince: null, frozenDates: Array.from(newFrozenDates) };
console.log(updatedHabit);

function isHabitDayFrozen(habit, dStr, todayStr) {
  if (habit.frozenDates?.includes(dStr)) return true;
  if (habit.isFrozen && habit.frozenSince) {
    if (dStr >= habit.frozenSince && dStr <= todayStr) {
      return true;
    }
  }
  return false;
}

console.log("Is today frozen?", isHabitDayFrozen(updatedHabit, todayStr, todayStr));
