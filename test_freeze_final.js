function isHabitDayFrozen(habit, dStr, todayStr) {
  if (!habit.isFrozen && dStr === todayStr) {
    return false;
  }
  if (habit.frozenDates?.includes(dStr)) return true;
  if (habit.isFrozen && habit.frozenSince) {
    if (dStr >= habit.frozenSince && dStr <= todayStr) {
      return true;
    }
  }
  return false;
}

const habit = {
  isFrozen: false,
  frozenSince: null,
  frozenDates: []
};

console.log(isHabitDayFrozen(habit, "2026-09-02", "2026-09-02"));
