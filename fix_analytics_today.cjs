const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsPage.tsx', 'utf8');

const targetMemo = `const todayCompletedHabits = useMemo(() => {
    return habits.filter(h => checkDayStatus(h, todayStr) === "completed");
  }, [habits, todayStr]);`;

const replaceMemo = `const todayDayOfWeek = today.getDay();
  const todayScheduledHabits = useMemo(() => {
    return habits.filter(h => {
      if (isHabitDayFrozen(h, todayStr, todayStr)) return false;
      const targetDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
      if (!targetDays.includes(todayDayOfWeek)) return false;
      return true;
    });
  }, [habits, todayStr, todayDayOfWeek]);

  const builtHabits = useMemo(() => todayScheduledHabits.filter(h => checkDayStatus(h, todayStr) === "completed"), [todayScheduledHabits, todayStr]);
  const underConstructionHabits = useMemo(() => todayScheduledHabits.filter(h => checkDayStatus(h, todayStr) !== "completed"), [todayScheduledHabits, todayStr]);`;

code = code.replace(targetMemo, replaceMemo);
fs.writeFileSync('src/components/AnalyticsPage.tsx', code);
