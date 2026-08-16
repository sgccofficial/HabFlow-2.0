import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { format, subDays, eachDayOfInterval, parseISO, getDay, isSameDay, startOfWeek, endOfWeek, isAfter, isBefore, isToday } from 'date-fns';
import { calculateStreak, calculateLongestStreak, cn, isHabitDayFrozen, formatDate, getHabitTargetValue, getHabitProgressValue, checkDayStatus } from '../lib/utils';
import { TrendingUp, Award, CalendarDays, Activity, Share2, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import { ShareMilestoneModal } from './ShareMilestoneModal';
import { getIcon } from './HabitCard';

export function AnalyticsPage() {
  const { habits, journal, activeHabitId, setActiveHabitId } = useAppContext();
  const [selectedHabitId, setSelectedHabitId] = useState<string>(activeHabitId || 'all');
  const [isTodayTasksOpen, setIsTodayTasksOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Sync with activeHabitId if it changes from outside
  React.useEffect(() => {
    if (activeHabitId) setSelectedHabitId(activeHabitId);
  }, [activeHabitId]);

  const handleSelectHabit = (id: string) => {
    setSelectedHabitId(id);
    setActiveHabitId(id === 'all' ? null : id);
    if (id !== 'all') {
      setTimeout(() => {
        const el = document.getElementById(`habit-tab-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
    }
  };

  // Helpers for dates
  const today = new Date();
  const last30Days = useMemo(() => eachDayOfInterval({ start: subDays(today, 29), end: today }), [today]);
  const calendarDays = useMemo(() => {
    const start = startOfWeek(subDays(today, 28));
    const end = endOfWeek(today);
    return eachDayOfInterval({ start, end });
  }, [today]);

  // Overall Insights
  const insights = useMemo(() => {
    if (habits.length === 0) return ["You haven't added any habits yet. Add some to see your analytics!"];
    
    const messages: string[] = [];
    
    // Calculate best day of week overall
    const completionsByDay = [0, 0, 0, 0, 0, 0, 0];
    const missedByDay = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    habits.forEach(habit => {
      last30Days.forEach(date => {
        const dStr = format(date, 'yyyy-MM-dd');
        if (dStr >= habit.created) {
          const dayIndex = getDay(date);
          if (habit.dates.includes(dStr)) {
            completionsByDay[dayIndex]++;
          } else {
            missedByDay[dayIndex]++;
          }
        }
      });
    });

    let bestDayIndex = -1;
    let worstDayIndex = -1;
    let bestRate = -1;
    let worstRate = 2; // more than 1

    for (let i = 0; i < 7; i++) {
      const total = completionsByDay[i] + missedByDay[i];
      if (total >= habits.length) { // Ensure enough data (at least 1 week passed for this habit)
        const rate = completionsByDay[i] / total;
        if (rate > bestRate) {
          bestRate = rate;
          bestDayIndex = i;
        }
        if (rate < worstRate) {
          worstRate = rate;
          worstDayIndex = i;
        }
      }
    }

    if (bestDayIndex !== -1 && bestRate > 0) {
      messages.push(`Your most productive day is typically ${dayNames[bestDayIndex]} with a ${(bestRate * 100).toFixed(0)}% success rate.`);
    }
    if (worstDayIndex !== -1 && worstRate < 1 && worstDayIndex !== bestDayIndex) {
      messages.push(`You tend to miss your habits most often on ${dayNames[worstDayIndex]}s.`);
    }

    // Morning vs Evening? We can't really tell unless we use reminderTime. Let's try.
    let morningCompletions = 0;
    let morningTotal = 0;
    let eveningCompletions = 0;
    let eveningTotal = 0;

    habits.forEach(habit => {
      const hour = parseInt(habit.reminderTime.split(':')[0], 10);
      const isMorning = hour < 12;
      
      last30Days.forEach(date => {
        const dStr = format(date, 'yyyy-MM-dd');
        if (dStr >= habit.created) {
          if (isMorning) {
            morningTotal++;
            if (habit.dates.includes(dStr)) morningCompletions++;
          } else {
            eveningTotal++;
            if (habit.dates.includes(dStr)) eveningCompletions++;
          }
        }
      });
    });

    if (morningTotal > 0 && eveningTotal > 0) {
      const morningRate = morningCompletions / morningTotal;
      const eveningRate = eveningCompletions / eveningTotal;
      if (morningRate > eveningRate + 0.1) {
        messages.push(`Your morning habits have a higher success rate than your evening ones.`);
      } else if (eveningRate > morningRate + 0.1) {
        messages.push(`You're more consistent with your evening routines than your morning ones.`);
      }
    }

    if (messages.length === 0) {
      messages.push("Keep tracking your habits to unlock personalized insights!");
    }

    return messages;
  }, [habits, last30Days]);

  // Overall Activity Heatmap Data
  const heatmapData = useMemo(() => {
    const activeHabitsList = habits.filter(h => !h.isFrozen);
    return last30Days.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      let count = 0;
      activeHabitsList.forEach(h => {
        if (h.dates.includes(dStr) && !isHabitDayFrozen(h, dStr, formatDate(today))) count++;
      });
      return { date: dStr, label: format(date, 'MMM d'), count };
    });
  }, [habits, last30Days]);

  // Specific Habit Analytics
  const selectedHabit = useMemo(() => habits.find(h => h.id === selectedHabitId), [habits, selectedHabitId]);

  const habitAnalytics = useMemo(() => {
    if (!selectedHabit) return null;
    let currentStreak = calculateStreak(selectedHabit);
    let longestStreak = calculateLongestStreak(selectedHabit);
    
    const createdDate = parseISO(selectedHabit.created);
    const daysSinceCreation = Math.max(1, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    let validDaysSinceCreation = 0;
    let validCompletions = 0;
    const todayStr = formatDate(today);
    
    for (let i = 0; i < daysSinceCreation; i++) {
      const d = new Date(createdDate);
      d.setDate(d.getDate() + i);
      const dStr = format(d, 'yyyy-MM-dd');
      
      const isFrozen = isHabitDayFrozen(selectedHabit, dStr, todayStr);
      if (!isFrozen) {
        const tDays = selectedHabit.targetDays || [0, 1, 2, 3, 4, 5, 6];
        if (tDays.includes(d.getDay())) validDaysSinceCreation++;
        if (checkDayStatus(selectedHabit, dStr) === 'completed') validCompletions++;
      }
    }
    
    const completionRate = validDaysSinceCreation > 0 ? Math.round((validCompletions / validDaysSinceCreation) * 100) : 0;

    // Activity over last 30 days
    const activityOverTime = last30Days.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'MMM d'),
        completed: selectedHabit.dates.includes(dStr) ? 1 : 0
      };
    });

    return { longestStreak, currentStreak, completionRate, activityOverTime };
  }, [selectedHabit, last30Days, today]);

  const overallStats = useMemo(() => {
    const activeHabitsList = habits.filter(h => !h.isFrozen);
    let totalCompletions = 0;
    let totalPossible = 0;
    let allTimeCompletions = 0;
    const todayStr = formatDate(today);
    
    habits.forEach(h => {
      let validComps = 0;
      const tDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
      let todayIdx = today.getTime();
      let createTime = new Date(h.created + 'T12:00:00').getTime();
      let days = Math.floor((todayIdx - createTime) / (1000*60*60*24)) + 1;
      for(let i=0; i<days; i++) {
        let d = new Date(h.created + 'T12:00:00'); d.setDate(d.getDate() + i);
        let ds = formatDate(d);
        if (!isHabitDayFrozen(h, ds, todayStr) && checkDayStatus(h, ds) === 'completed') {
           validComps++;
        }
      }
      allTimeCompletions += validComps;
    });
    
    activeHabitsList.forEach(h => {
      const createdDate = parseISO(h.created);
      const daysSinceCreation = Math.max(1, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      let validDays = 0;
      let validCompletions = 0;
      for (let i = 0; i < daysSinceCreation; i++) {
        const d = new Date(createdDate);
        d.setDate(d.getDate() + i);
        const dStr = format(d, 'yyyy-MM-dd');
        if (!isHabitDayFrozen(h, dStr, todayStr)) {
          const tDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
          if (tDays.includes(d.getDay())) validDays++;
          if (checkDayStatus(h, dStr) === 'completed') validCompletions++;
        }
      }
      
      totalCompletions += validCompletions;
      totalPossible += validDays;
    });
    
    const consistencyRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
    return {
      totalCompletions,
      allTimeCompletions,
      activeHabits: activeHabitsList.length,
      consistencyRate
    };
  }, [habits, today]);

  const todayStr = formatDate(today);
  const todayDayOfWeek = today.getDay();
  const todayScheduledHabits = useMemo(() => {
    return habits.filter(h => {
      if (isHabitDayFrozen(h, todayStr, todayStr)) return false;
      const targetDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
      if (!targetDays.includes(todayDayOfWeek)) return false;
      return true;
    });
  }, [habits, todayStr, todayDayOfWeek]);

  const builtHabits = useMemo(() => todayScheduledHabits.filter(h => checkDayStatus(h, todayStr) === "completed"), [todayScheduledHabits, todayStr]);
  const underConstructionHabits = useMemo(() => todayScheduledHabits.filter(h => checkDayStatus(h, todayStr) !== "completed"), [todayScheduledHabits, todayStr]);

  const renderHabitList = (habitList: typeof habits, showCheck: boolean) => (
    <div className="space-y-2">
      {habitList.map(habit => {
        const streak = calculateStreak(habit);
        return (
          <div
            key={habit.id}
            onClick={() => handleSelectHabit(habit.id)}
            role="button"
            tabIndex={0}
            className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-100 dark:border-gray-700/50 cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                style={{ backgroundColor: habit.color }}
              >
                {getIcon(habit.icon)}
              </div>
              <div className="min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {habit.name}
                </h4>
                {habit.category && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 block truncate">
                    {habit.category}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {streak > 0 ? (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${showCheck ? 'text-orange-500 bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-800/30' : 'text-gray-400 bg-gray-100 dark:text-gray-500 dark:bg-gray-800 border-gray-200 dark:border-gray-700 grayscale opacity-70'}`}>
                  🔥 {streak}
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 flex items-center gap-1">
                  0
                </span>
              )}
              {showCheck && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderBlocks = (specificHabit?: any) => {
    const todayStr = formatDate(today);
    return (
      <div className="flex w-full justify-center mt-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-3 w-full sm:max-w-[360px]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`day-${i}`} className="text-[10px] font-medium text-gray-400 dark:text-gray-500 text-center mb-1">{d}</div>
        ))}
        {calendarDays.map((date, idx) => {
          const dStr = format(date, 'yyyy-MM-dd');
          let colorClass = 'bg-gray-100 dark:bg-gray-800/50';
          let tooltip = format(date, 'MMM d, yyyy');

          if (isAfter(date, today) && !isSameDay(date, today)) {
            colorClass = 'bg-gray-100 dark:bg-gray-800/30';
            tooltip += ' (Future)';
          } else {
            if (specificHabit) {
              const status = checkDayStatus(specificHabit, dStr);
              const isDone = status === 'completed';
              const isPartial = status === 'partial';
              const isNotCreated = dStr < specificHabit.created;
              const isFrozen = isHabitDayFrozen(specificHabit, dStr, todayStr);
              const targetDays = specificHabit.targetDays || [0, 1, 2, 3, 4, 5, 6];
              const isTargetDay = targetDays.includes(date.getDay());
              
              if (isFrozen) {
                colorClass = 'bg-blue-400 dark:bg-blue-500 shadow-sm';
                tooltip += ' - Paused';
              } else if (isDone) {
                colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';
                tooltip += ' - Completed';
              } else if (isPartial) {
                const pVal = getHabitProgressValue(specificHabit, dStr);
                const tVal = getHabitTargetValue(specificHabit);
                colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                tooltip += ` - Partial (${pVal}/${tVal})`;
              } else if (!isTargetDay) {
                colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                tooltip += ' - Rest Day';
              } else if (isSameDay(date, today)) {
                colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                tooltip += ' - Today';
              } else if (isNotCreated) {
                colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                tooltip += ' - Not created yet';
              } else {
                colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                tooltip += ' - Missed';
              }
            } else {
              // Overview
              const activeHabitsList = habits.filter(h => !h.isFrozen);
              if (habits.length === 0) {
                colorClass = isSameDay(date, today) ? 'bg-yellow-400 dark:bg-yellow-500 shadow-sm' : 'bg-gray-100 dark:bg-gray-800/30';
              } else {
                const isNotCreated = habits.length > 0 ? dStr < [...habits].sort((a, b) => a.created.localeCompare(b.created))[0].created : true;
                
                let completedCount = 0;
                let activeCount = 0;
                let frozenCount = 0;
                let partialCount = 0;
                habits.forEach(h => {
                  if (dStr >= h.created) {
                    if (isHabitDayFrozen(h, dStr, todayStr)) {
                      frozenCount++;
                    } else {
                      const tDays = h.targetDays || [0, 1, 2, 3, 4, 5, 6];
                      const isTDay = tDays.includes(date.getDay());
                      const status = checkDayStatus(h, dStr);
                      const isDone = status === 'completed';
                      const isPartial = status === 'partial';
                      if (isTDay || isDone || isPartial) {
                        activeCount++;
                        if (isDone) completedCount++;
                        else if (isPartial) partialCount++;
                      }
                    }
                  }
                });
                
                if (activeCount === 0 && frozenCount > 0) {
                  colorClass = 'bg-blue-400 dark:bg-blue-500 shadow-sm';
                  tooltip += ' - Paused';
                } else if (activeCount > 0) {
                  const ratio = completedCount / activeCount;
                  if (completedCount === 0 && partialCount === 0) {
                    colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                    tooltip += ' - None done';
                  } else if (completedCount === 0 && partialCount > 0) {
                    colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                    tooltip += ' - Partial done';
                  } else if (ratio > 0.5) {
                    colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';
                    tooltip += ` - ${completedCount}/${activeCount} done`;
                  } else if (ratio >= 0.4 || partialCount > 0) {
                    colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                    tooltip += ` - ${completedCount}/${activeCount} done`;
                  } else {
                    colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                    tooltip += ` - ${completedCount}/${activeCount} done`;
                  }
                } else if (isSameDay(date, today)) {
                  colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                  tooltip += ' - Today (No active habits)';
                } else if (isNotCreated) {
                  colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                  tooltip += ' - Not created yet';
                } else {
                  colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                  tooltip += ' - No habits active';
                }
              }
            }
          }

          return (
            <div 
              key={idx} 
              title={tooltip}
              className={cn(
                "aspect-square rounded-lg transition-colors cursor-default",
                colorClass
              )} 
            />
          );
        })}
      </div>
      </div>
    );
  };

  return (
    <div className="pb-24 pt-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 p-4 rounded-2xl bg-white/40 dark:bg-black/30 backdrop-blur-md shadow-sm border border-white/20 dark:border-white/10">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleSelectHabit('all')}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
              selectedHabitId === 'all' ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            )}
          >
            Overview
          </button>
          {habits.map(h => (
            <button
              key={h.id}
              id={`habit-tab-${h.id}`}
              onClick={() => handleSelectHabit(h.id)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedHabitId === h.id ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
              )}
            >
              {h.name}
            </button>
          ))}
        </div>

        {selectedHabitId === 'all' ? (
          <div className="space-y-6">
            {/* Today's Builds */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
              <div 
                className={cn("flex items-center justify-between cursor-pointer group", isTodayTasksOpen ? "mb-3" : "")}
                onClick={() => setIsTodayTasksOpen(!isTodayTasksOpen)}
                role="button"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Today's Builds</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30">
                    {builtHabits.length} / {underConstructionHabits.length}
                  </span>
                  {isTodayTasksOpen ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                    )}
                </div>
              </div>

              {isTodayTasksOpen && (
                <div className="space-y-4 mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                  {builtHabits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Built</h4>
                      {renderHabitList(builtHabits, true)}
                    </div>
                  )}
                  {underConstructionHabits.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Under Construction</h4>
                      {renderHabitList(underConstructionHabits, false)}
                    </div>
                  )}
                  {todayScheduledHabits.length === 0 && (
                    <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                      No tasks scheduled for today
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Heatmap/Activity Chart */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Heat Map</h3>
                <span className="text-xs text-gray-400">Recent</span>
              </div>
              {renderBlocks()}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
                <CalendarDays className="w-6 h-6 text-emerald-500 mb-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{overallStats.allTimeCompletions}</span>
                <span className="text-xs text-gray-500 font-medium">Overall Completions</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
                <Activity className="w-6 h-6 text-orange-500 mb-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{overallStats.activeHabits}</span>
                <span className="text-xs text-gray-500 font-medium">Active Habits</span>
              </div>
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/30 mt-4"
            >
              <Share2 className="w-4 h-4" /> Share Overview
            </button>
            
            {showShareModal && (
              <ShareMilestoneModal 
                overallStats={overallStats} 
                onClose={() => setShowShareModal(false)} 
              />
            )}
          </div>
        ) : selectedHabit && habitAnalytics ? (
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Streak</span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{habitAnalytics.currentStreak}</span>
                  <span className="text-sm font-medium text-orange-500 mb-1">Days</span>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Longest Streak</span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{habitAnalytics.longestStreak}</span>
                  <span className="text-sm font-medium text-indigo-500 mb-1">Days</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Consistency Rate</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{habitAnalytics.completionRate}%</span>
              </div>
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30" style={{
                backgroundImage: `conic-gradient(#4f46e5 ${habitAnalytics.completionRate}%, transparent 0)`
              }}>
                <div className="w-14 h-14 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
                  <Award className="w-6 h-6 text-indigo-500" />
                </div>
              </div>
            </div>

            {/* Completion Chart / Heatmap */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Heat Map</h3>
                <span className="text-xs text-gray-400">Over Time</span>
              </div>
              {renderBlocks(selectedHabit)}
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800/30 mt-4"
            >
              <Share2 className="w-4 h-4" /> Share Milestone
            </button>
            
            {showShareModal && (
              <ShareMilestoneModal 
                habit={selectedHabit} 
                habitCompletionRate={habitAnalytics.completionRate}
                onClose={() => setShowShareModal(false)} 
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
