const fs = require('fs');
let code = fs.readFileSync('src/lib/utils.ts', 'utf8');

const newUtils = `
export function getHabitTargetValue(habit: Habit): number {
  const isTimely = habit.durationGoal !== undefined ? habit.durationGoal > 0 : habit.goalType === 'duration';
  const durationGoal = habit.durationGoal || (habit.goalType === 'duration' ? (habit.durationUnit === 'hr' ? (habit.goalValue || 0) * 3600 : habit.durationUnit === 'min' ? (habit.goalValue || 0) * 60 : (habit.goalValue || 0)) : 0);
  const isDaily = habit.dailyCompletions !== undefined ? habit.dailyCompletions > 0 : (habit.goalType === 'daily' || habit.goalType === 'weekly');
  const dailyCompletions = habit.dailyCompletions || ((habit.goalType === 'daily' || habit.goalType === 'weekly') ? habit.goalValue || 1 : 1);
  let targetValue = 1;
  if (isTimely) {
    targetValue = durationGoal * (isDaily ? dailyCompletions : 1);
  } else if (isDaily) {
    targetValue = dailyCompletions;
  }
  return targetValue;
}

export function getHabitProgressValue(habit: Habit, dStr: string): number {
  return habit.progress?.[dStr] ?? (habit.dates.includes(dStr) ? getHabitTargetValue(habit) : 0);
}

export function checkDayStatus(habit: Habit, dStr: string): 'completed' | 'partial' | 'none' {
  const val = getHabitProgressValue(habit, dStr);
  if (val === 0) return 'none';
  const targetValue = getHabitTargetValue(habit);
  const targetDays = habit.targetDays || [0, 1, 2, 3, 4, 5, 6];
  const dateObj = new Date(dStr + 'T12:00:00');
  
  if (!targetDays.includes(dateObj.getDay())) {
    return 'completed'; // Any progress on rest day counts as completed
  }
  
  return val >= targetValue ? 'completed' : 'partial';
}
`;

code = code.replace("export function calculateStreak(habit: Habit): number {", newUtils + "\nexport function calculateStreak(habit: Habit): number {");

// update calculateStreak
code = code.replace(/const isTimely =[\s\S]*?const checkDayCompleted =[\s\S]*?return val >= targetValue;\s*};\s*/, "");
// wait, calculateLongestStreak also needs replacement
code = code.replace(/const isTimely =[\s\S]*?const checkDayCompleted =[\s\S]*?return val >= targetValue;\s*};\s*/, "");

// we replace checkDayCompleted(dStr) with checkDayStatus(habit, dStr) === 'completed' in calculateStreak
code = code.replace(/checkDayCompleted\(dStr\)/g, "checkDayStatus(habit, dStr) === 'completed'");

fs.writeFileSync('src/lib/utils.ts', code);
