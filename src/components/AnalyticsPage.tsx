import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { format, subDays, eachDayOfInterval, parseISO, getDay, isSameDay, startOfWeek, endOfWeek, isAfter, isBefore, isToday } from 'date-fns';
import { calculateStreak, cn, isHabitDayFrozen, formatDate } from '../lib/utils';
import { TrendingUp, Award, CalendarDays, Activity, Share2 } from 'lucide-react';
import { ShareMilestoneModal } from './ShareMilestoneModal';

export function AnalyticsPage() {
  const { habits, journal, activeHabitId, setActiveHabitId } = useAppContext();
  const [selectedHabitId, setSelectedHabitId] = useState<string>(activeHabitId || 'all');
  const [showShareModal, setShowShareModal] = useState(false);

  // Sync with activeHabitId if it changes from outside
  React.useEffect(() => {
    if (activeHabitId) setSelectedHabitId(activeHabitId);
  }, [activeHabitId]);

  const handleSelectHabit = (id: string) => {
    setSelectedHabitId(id);
    setActiveHabitId(id === 'all' ? null : id);
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
    let longestStreak = 0;
    let currentStreak = calculateStreak(selectedHabit);
    
    // Custom longest streak calculation ignoring frozen days and non-target days
    const createdDate = parseISO(selectedHabit.created);
    const daysSinceCreation = Math.max(1, Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    let tempStreak = 0;
    let validDaysSinceCreation = 0;
    const todayStr = formatDate(today);
    
    for (let i = 0; i < daysSinceCreation; i++) {
      const d = new Date(createdDate);
      d.setDate(d.getDate() + i);
      const dStr = format(d, 'yyyy-MM-dd');
      
      const isFrozen = isHabitDayFrozen(selectedHabit, dStr, todayStr);
      if (!isFrozen) {
        validDaysSinceCreation++;
        const targetDays = selectedHabit.targetDays || [0, 1, 2, 3, 4, 5, 6];
        const dayOfWeek = d.getDay();
        const isTarget = targetDays.includes(dayOfWeek);
        
        const completed = selectedHabit.dates.includes(dStr);
        if (completed) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else if (isTarget) {
          tempStreak = 0;
        }
      }
    }
    
    const completionRate = validDaysSinceCreation > 0 ? Math.round((selectedHabit.dates.length / validDaysSinceCreation) * 100) : 0;

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
    const todayStr = formatDate(today);
    
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
          validDays++;
          if (h.dates.includes(dStr)) validCompletions++;
        }
      }
      
      totalCompletions += validCompletions;
      totalPossible += validDays;
    });
    
    const consistencyRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
    return {
      totalCompletions,
      activeHabits: activeHabitsList.length,
      consistencyRate
    };
  }, [habits, today]);

  const renderBlocks = (specificHabit?: any) => {
    const todayStr = formatDate(today);
    return (
      <div className="grid grid-cols-7 gap-2 mt-2">
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
              const isDone = specificHabit.dates.includes(dStr);
              const isNotCreated = dStr < specificHabit.created;
              const isFrozen = isHabitDayFrozen(specificHabit, dStr, todayStr);
              
              if (isFrozen) {
                colorClass = 'bg-blue-100 dark:bg-blue-900/40 shadow-sm';
                tooltip += ' - Paused';
              } else if (isDone) {
                colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';
                tooltip += ' - Completed';
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
              if (activeHabitsList.length === 0) {
                colorClass = isSameDay(date, today) ? 'bg-yellow-400 dark:bg-yellow-500 shadow-sm' : 'bg-gray-100 dark:bg-gray-800/30';
              } else {
                const earliestHabit = [...activeHabitsList].sort((a, b) => a.created.localeCompare(b.created))[0];
                const isNotCreated = earliestHabit ? dStr < earliestHabit.created : true;
                
                let completedCount = 0;
                let activeCount = 0;
                activeHabitsList.forEach(h => {
                  if (dStr >= h.created && !isHabitDayFrozen(h, dStr, todayStr)) {
                    activeCount++;
                    if (h.dates.includes(dStr)) completedCount++;
                  }
                });
                
                if (completedCount > 0 && completedCount === activeCount) {
                  colorClass = 'bg-emerald-400 dark:bg-emerald-500 shadow-sm';
                  tooltip += ` - All ${completedCount} done`;
                } else if (completedCount > 0) {
                  colorClass = 'bg-emerald-300 dark:bg-emerald-400/70 shadow-sm';
                  tooltip += ` - ${completedCount}/${activeCount} done`;
                } else if (isSameDay(date, today)) {
                  colorClass = 'bg-yellow-400 dark:bg-yellow-500 shadow-sm';
                  tooltip += ' - Today';
                } else if (isNotCreated || activeCount === 0) {
                  colorClass = 'bg-gray-100 dark:bg-gray-800/30';
                  tooltip += ' - No habits active';
                } else {
                  colorClass = 'bg-red-400 dark:bg-red-500 shadow-sm';
                  tooltip += ' - None done';
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
    );
  };

  return (
    <div className="pb-24 pt-8 px-4">
      <div className="max-w-md mx-auto">
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
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{heatmapData.reduce((acc, val) => acc + val.count, 0)}</span>
                <span className="text-xs text-gray-500 font-medium">Recent Completions</span>
              </div>
              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center">
                <Activity className="w-6 h-6 text-orange-500 mb-2" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{habits.length}</span>
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
                onClose={() => setShowShareModal(false)} 
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
