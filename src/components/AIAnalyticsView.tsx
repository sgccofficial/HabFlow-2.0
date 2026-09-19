import React, { useState, useEffect, useMemo } from 'react';
import { Habit } from '../types';
import { useAppContext } from '../store/AppContext';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Sun, 
  Sunrise, 
  Sunset, 
  Moon, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Lightbulb, 
  Flame, 
  ShieldAlert,
  ChevronRight,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import { 
  formatDate, 
  calculateStreak, 
  calculateLongestStreak, 
  calculateHabitConsistency, 
  checkDayStatus, 
  isHabitDayFrozen,
  getHabitScheduleForDate,
  cn 
} from '../lib/utils';
import { subDays, eachDayOfInterval, format, getDay } from 'date-fns';
import { getIcon } from './HabitCard';

interface AIAnalyticsViewProps {
  habits: Habit[];
  today: Date;
  onSelectHabit: (id: string) => void;
}

interface AIResponseData {
  executiveSummary?: string;
  mostConsistentAnalysis?: {
    title: string;
    observation: string;
    topHabitNames?: string[];
  };
  repeatedlyMissedAnalysis?: {
    title: string;
    observation: string;
    missedHabitNames?: string[];
    actionableFix?: string;
  };
  timeOfDayInsight?: {
    title: string;
    observation: string;
    optimalWindow?: string;
  };
  consistencyTrends30vs90?: {
    title: string;
    observation: string;
    direction?: 'improving' | 'declining' | 'steady';
  };
  improvingHabitsInsight?: {
    title: string;
    observation: string;
    habits?: string[];
  };
  stagnatingHabitsInsight?: {
    title: string;
    observation: string;
    habits?: string[];
  };
  smartRecommendations?: string[];
  motivationalTakeaway?: string;
}

export const AIAnalyticsView: React.FC<AIAnalyticsViewProps> = ({ habits, today, onSelectHabit }) => {
  const { appSettings, updateAppSettings } = useAppContext();
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30' | '90'>('30');
  const [aiData, setAiData] = useState<AIResponseData | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const isAiEnabled = appSettings?.aiAnalysisEnabled !== false;

  const todayStr = useMemo(() => formatDate(today), [today]);

  // Compute intervals
  const last14Days = useMemo(() => eachDayOfInterval({ start: subDays(today, 13), end: today }), [today]);
  const last30Days = useMemo(() => eachDayOfInterval({ start: subDays(today, 29), end: today }), [today]);
  const prior30Days = useMemo(() => eachDayOfInterval({ start: subDays(today, 59), end: subDays(today, 30) }), [today]);
  const last90Days = useMemo(() => eachDayOfInterval({ start: subDays(today, 89), end: today }), [today]);

  // Helper to calculate rate for a habit over a list of dates
  const calculateRateForDates = (habit: Habit, dates: Date[]) => {
    let scheduled = 0;
    let completed = 0;
    dates.forEach(d => {
      const dStr = format(d, 'yyyy-MM-dd');
      if (dStr >= habit.created) {
        if (!isHabitDayFrozen(habit, dStr, todayStr)) {
          const schedule = getHabitScheduleForDate(habit, dStr);
          if (schedule.targetDays.includes(d.getDay())) {
            scheduled++;
            if (checkDayStatus(habit, dStr) === 'completed') {
              completed++;
            }
          }
        }
      }
    });
    return {
      scheduled,
      completed,
      rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
    };
  };

  // Comprehensive analytics calculation
  const habitAnalytics = useMemo(() => {
    const list = habits.map(habit => {
      const streak = calculateStreak(habit, todayStr);
      const longest = calculateLongestStreak(habit, todayStr);
      const overall = calculateHabitConsistency(habit, today);
      const r14 = calculateRateForDates(habit, last14Days);
      const r30 = calculateRateForDates(habit, last30Days);
      const rPrior30 = calculateRateForDates(habit, prior30Days);
      const r90 = calculateRateForDates(habit, last90Days);

      // Missed days of the week in last 30 days
      const missedDayCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      last30Days.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (dStr >= habit.created && !isHabitDayFrozen(habit, dStr, todayStr)) {
          const schedule = getHabitScheduleForDate(habit, dStr);
          if (schedule.targetDays.includes(d.getDay())) {
            if (checkDayStatus(habit, dStr) !== 'completed' && dStr !== todayStr) {
              missedDayCounts[d.getDay()] = (missedDayCounts[d.getDay()] || 0) + 1;
            }
          }
        }
      });

      // Find day with highest misses
      let maxMissDay = -1;
      let maxMissCount = 0;
      Object.entries(missedDayCounts).forEach(([day, count]) => {
        if (count > maxMissCount) {
          maxMissCount = count;
          maxMissDay = parseInt(day, 10);
        }
      });

      // Status determination
      let status: 'consistent' | 'improving' | 'stagnating' | 'missed' = 'consistent';
      const momentumDelta = r14.rate - r30.rate;

      if (r30.rate < 40 || (r14.rate === 0 && r14.scheduled >= 3)) {
        status = 'missed';
      } else if (momentumDelta >= 10 && r14.rate >= 50) {
        status = 'improving';
      } else if (momentumDelta <= -10 || (r30.rate <= 50 && r14.rate <= 50)) {
        status = 'stagnating';
      } else if (r30.rate >= 75) {
        status = 'consistent';
      }

      return {
        habit,
        streak,
        longest,
        overallConsistency: overall.consistencyRate,
        r14,
        r30,
        rPrior30,
        r90,
        momentumDelta,
        maxMissDay,
        maxMissCount,
        status,
        reminderTime: habit.reminderTime || '09:00'
      };
    });

    return list;
  }, [habits, today, todayStr, last14Days, last30Days, prior30Days, last90Days]);

  // Ranked Lists
  const mostConsistentHabits = useMemo(() => {
    return [...habitAnalytics]
      .filter(item => item.r30.scheduled > 0)
      .sort((a, b) => b.r30.rate - a.r30.rate || b.streak - a.streak);
  }, [habitAnalytics]);

  const repeatedlyMissedHabits = useMemo(() => {
    return [...habitAnalytics]
      .filter(item => item.r30.scheduled >= 3 && item.r30.rate < 60)
      .sort((a, b) => a.r30.rate - b.r30.rate);
  }, [habitAnalytics]);

  const improvingHabits = useMemo(() => {
    return [...habitAnalytics]
      .filter(item => item.momentumDelta >= 8 && item.r14.rate >= 40)
      .sort((a, b) => b.momentumDelta - a.momentumDelta);
  }, [habitAnalytics]);

  const stagnatingHabits = useMemo(() => {
    return [...habitAnalytics]
      .filter(item => 
        (item.momentumDelta <= -8 && item.r30.scheduled >= 3) || 
        (item.r14.rate === 0 && item.r14.scheduled >= 2) ||
        (item.habit.isFrozen)
      )
      .sort((a, b) => a.momentumDelta - b.momentumDelta);
  }, [habitAnalytics]);

  // Time of Day Analysis
  const timeOfDayStats = useMemo(() => {
    // Categories: Morning (5-11), Afternoon (12-16), Evening (17-20), Night (21-4)
    const breakdown = {
      morning: { label: 'Morning', icon: Sunrise, timeSpan: '5:00 AM – 11:59 AM', scheduled: 0, completed: 0, habitCount: 0 },
      afternoon: { label: 'Afternoon', icon: Sun, timeSpan: '12:00 PM – 4:59 PM', scheduled: 0, completed: 0, habitCount: 0 },
      evening: { label: 'Evening', icon: Sunset, timeSpan: '5:00 PM – 8:59 PM', scheduled: 0, completed: 0, habitCount: 0 },
      night: { label: 'Night', icon: Moon, timeSpan: '9:00 PM – 4:59 AM', scheduled: 0, completed: 0, habitCount: 0 },
    };

    habits.forEach(h => {
      const hour = parseInt(h.reminderTime ? h.reminderTime.split(':')[0] : '9', 10);
      let slot: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
      if (hour >= 5 && hour < 12) slot = 'morning';
      else if (hour >= 12 && hour < 17) slot = 'afternoon';
      else if (hour >= 17 && hour < 21) slot = 'evening';
      else slot = 'night';

      breakdown[slot].habitCount++;

      last30Days.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (dStr >= h.created && !isHabitDayFrozen(h, dStr, todayStr)) {
          const schedule = getHabitScheduleForDate(h, dStr);
          if (schedule.targetDays.includes(d.getDay())) {
            breakdown[slot].scheduled++;
            if (checkDayStatus(h, dStr) === 'completed') {
              breakdown[slot].completed++;
            }
          }
        }
      });
    });

    return breakdown;
  }, [habits, last30Days, todayStr]);

  // Overall 30 vs 90 day aggregate stats
  const aggregateTrajectory = useMemo(() => {
    let s30 = 0, c30 = 0;
    let sPrior30 = 0, cPrior30 = 0;
    let s90 = 0, c90 = 0;

    habitAnalytics.forEach(item => {
      s30 += item.r30.scheduled;
      c30 += item.r30.completed;
      sPrior30 += item.rPrior30.scheduled;
      cPrior30 += item.rPrior30.completed;
      s90 += item.r90.scheduled;
      c90 += item.r90.completed;
    });

    const rate30 = s30 > 0 ? Math.round((c30 / s30) * 100) : 0;
    const ratePrior30 = sPrior30 > 0 ? Math.round((cPrior30 / sPrior30) * 100) : 0;
    const rate90 = s90 > 0 ? Math.round((c90 / s90) * 100) : 0;
    const diff30vsPrior = rate30 - ratePrior30;
    const diff30vs90 = rate30 - rate90;

    return {
      rate30,
      ratePrior30,
      rate90,
      diff30vsPrior,
      diff30vs90,
      totalCompletions30: c30,
      totalCompletions90: c90
    };
  }, [habitAnalytics]);

  // Day of Week completion rate
  const dayOfWeekMatrix = useMemo(() => {
    const days = [
      { name: 'Sun', scheduled: 0, completed: 0 },
      { name: 'Mon', scheduled: 0, completed: 0 },
      { name: 'Tue', scheduled: 0, completed: 0 },
      { name: 'Wed', scheduled: 0, completed: 0 },
      { name: 'Thu', scheduled: 0, completed: 0 },
      { name: 'Fri', scheduled: 0, completed: 0 },
      { name: 'Sat', scheduled: 0, completed: 0 },
    ];

    habits.forEach(h => {
      last30Days.forEach(d => {
        const dStr = format(d, 'yyyy-MM-dd');
        if (dStr >= h.created && !isHabitDayFrozen(h, dStr, todayStr)) {
          const schedule = getHabitScheduleForDate(h, dStr);
          const dayIndex = getDay(d);
          if (schedule.targetDays.includes(dayIndex)) {
            days[dayIndex].scheduled++;
            if (checkDayStatus(h, dStr) === 'completed') {
              days[dayIndex].completed++;
            }
          }
        }
      });
    });

    return days.map(d => ({
      ...d,
      rate: d.scheduled > 0 ? Math.round((d.completed / d.scheduled) * 100) : 0
    }));
  }, [habits, last30Days, todayStr]);

  const bestDay = useMemo(() => {
    const sorted = [...dayOfWeekMatrix].filter(d => d.scheduled > 0).sort((a, b) => b.rate - a.rate);
    return sorted[0] || null;
  }, [dayOfWeekMatrix]);

  const hardestDay = useMemo(() => {
    const sorted = [...dayOfWeekMatrix].filter(d => d.scheduled > 0).sort((a, b) => a.rate - b.rate);
    return sorted[0] || null;
  }, [dayOfWeekMatrix]);

  // Fetch AI Analytics from server
  const fetchAIInsights = async () => {
    if (!isAiEnabled || habits.length === 0) return;
    setLoadingAi(true);
    setAiError(null);

    try {
      const payload = {
        habitsData: habitAnalytics.map(ha => ({
          name: ha.habit.name,
          category: ha.habit.category || 'General',
          streak: ha.streak,
          longestStreak: ha.longest,
          consistencyRate30d: ha.r30.rate,
          consistencyRate90d: ha.r90.rate,
          momentumDelta: ha.momentumDelta,
          reminderTime: ha.reminderTime,
          status: ha.status
        })),
        timeOfDayData: {
          morningRate: timeOfDayStats.morning.scheduled > 0 ? Math.round((timeOfDayStats.morning.completed / timeOfDayStats.morning.scheduled) * 100) : 0,
          afternoonRate: timeOfDayStats.afternoon.scheduled > 0 ? Math.round((timeOfDayStats.afternoon.completed / timeOfDayStats.afternoon.scheduled) * 100) : 0,
          eveningRate: timeOfDayStats.evening.scheduled > 0 ? Math.round((timeOfDayStats.evening.completed / timeOfDayStats.evening.scheduled) * 100) : 0,
          nightRate: timeOfDayStats.night.scheduled > 0 ? Math.round((timeOfDayStats.night.completed / timeOfDayStats.night.scheduled) * 100) : 0,
        },
        statsOverview: {
          rate30: aggregateTrajectory.rate30,
          rate90: aggregateTrajectory.rate90,
          diff: aggregateTrajectory.diff30vs90,
          bestDay: bestDay?.name,
          hardestDay: hardestDay?.name
        }
      };

      const res = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Server returned an error');
      }

      const json = await res.json();
      if (json.available && json.data) {
        setAiData(json.data);
      } else {
        // Fallback: rule-based insights if Gemini is unavailable or key not set
        generateFallbackInsights();
      }
    } catch (e: any) {
      console.warn('AI analytics fetch fallback:', e);
      generateFallbackInsights();
    } finally {
      setLoadingAi(false);
    }
  };

  const generateFallbackInsights = () => {
    const topHabits = mostConsistentHabits.slice(0, 2).map(h => h.habit.name);
    const missedHabits = repeatedlyMissedHabits.slice(0, 2).map(h => h.habit.name);
    const improving = improvingHabits.slice(0, 2).map(h => h.habit.name);
    const stagnating = stagnatingHabits.slice(0, 2).map(h => h.habit.name);

    let primeSlot = 'Morning';
    let maxSlotRate = -1;
    Object.entries(timeOfDayStats).forEach(([slot, val]) => {
      const r = val.scheduled > 0 ? val.completed / val.scheduled : 0;
      if (r > maxSlotRate) {
        maxSlotRate = r;
        primeSlot = val.label;
      }
    });

    setAiData({
      executiveSummary: `Your habit execution over the past 30 days stands at ${aggregateTrajectory.rate30}%, reflecting a ${aggregateTrajectory.diff30vs90 >= 0 ? '+' + aggregateTrajectory.diff30vs90 + '% progression' : aggregateTrajectory.diff30vs90 + '% change'} relative to your 90-day baseline.`,
      mostConsistentAnalysis: {
        title: "Top Consistent Habits",
        observation: topHabits.length > 0
          ? `${topHabits.join(' and ')} demonstrate exceptional anchoring with strong daily momentum.`
          : "Keep logging daily completions to identify your core foundation habits.",
        topHabitNames: topHabits
      },
      repeatedlyMissedAnalysis: {
        title: "Habits Experiencing Friction",
        observation: missedHabits.length > 0
          ? `${missedHabits.join(', ')} show frequent drop-offs, especially around high-friction days like ${hardestDay ? hardestDay.name : 'midweek'}.`
          : "No severely neglected habits detected in your active schedule.",
        missedHabitNames: missedHabits,
        actionableFix: "Try lowering the daily required minimum or linking the habit right after a solid morning routine."
      },
      timeOfDayInsight: {
        title: "Circadian Willpower Window",
        observation: `You exhibit your highest completion reliability in the ${primeSlot}, making it the prime time to schedule high-effort habits.`,
        optimalWindow: `${primeSlot} Routine Window`
      },
      consistencyTrends30vs90: {
        title: "30-Day vs 90-Day Velocity",
        observation: aggregateTrajectory.diff30vs90 >= 0
          ? `Your 30-day consistency (${aggregateTrajectory.rate30}%) is outpacing your 90-day baseline (${aggregateTrajectory.rate90}%), showing positive habit hardening.`
          : `Your recent 30-day rate (${aggregateTrajectory.rate30}%) is slightly below your 90-day historical average (${aggregateTrajectory.rate90}%). Focus on resetting one anchor habit first.`,
        direction: aggregateTrajectory.diff30vs90 >= 5 ? 'improving' : aggregateTrajectory.diff30vs90 <= -5 ? 'declining' : 'steady'
      },
      improvingHabitsInsight: {
        title: "Accelerating Momentum",
        observation: improving.length > 0 
          ? `${improving.join(', ')} showed a strong leap in completion velocity over the last two weeks.`
          : "Consistency is steady across your active schedule.",
        habits: improving
      },
      stagnatingHabitsInsight: {
        title: "Stagnating / At-Risk Habits",
        observation: stagnating.length > 0
          ? `${stagnating.join(', ')} are currently plateauing or frozen. Shrinking the target scope can reignite momentum.`
          : "None of your habits are currently exhibiting prolonged stagnation.",
        habits: stagnating
      },
      smartRecommendations: [
        `Anchor secondary tasks to your most reliable habit: ${topHabits[0] || 'your morning anchor'}.`,
        hardestDay ? `Anticipate ${hardestDay.name} friction by setting an earlier reminder or doing a 2-minute micro-version.` : "Set distinct morning and evening reminders to prevent cognitive overload.",
        "Celebrate small completions—every checkmark prevents habit decay."
      ],
      motivationalTakeaway: "Consistency isn't about never missing; it's about returning to the rhythm immediately without self-criticism."
    });
  };

  useEffect(() => {
    if (isAiEnabled) {
      fetchAIInsights();
    }
  }, [isAiEnabled, habits.length]);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // If user has disabled AI analysis in profile settings:
  if (!isAiEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-sm border border-purple-100 dark:border-purple-950/40 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mx-auto flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Analysis is Turned Off</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
            AI-powered habit intelligence, circadian time analysis, and 30/90-day trajectory diagnostics are currently disabled in your profile preferences.
          </p>
          <button
            onClick={() => updateAppSettings({ aiAnalysisEnabled: true })}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium text-sm shadow-md hover:from-purple-700 hover:to-indigo-700 transition"
          >
            <Sparkles className="w-4 h-4" />
            Enable AI Analysis
          </button>
        </div>
      </div>
    );
  }

  // If user has no habits:
  if (habits.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 text-center border border-gray-100 dark:border-gray-800">
        <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Habit Data Yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
          Create and track a few habits first. AI will immediately analyze your performance patterns!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* AI Header Card */}
      <div className="bg-gradient-to-br from-purple-900 via-indigo-950 to-gray-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-purple-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">AI Habit Intelligence</h2>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-200 border border-purple-300/20">
                  Gemini Flash
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-0.5">
                Behavioral diagnostics, circadian trends, and trajectory modeling
              </p>
            </div>
          </div>

          <button
            onClick={fetchAIInsights}
            disabled={loadingAi}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition text-xs font-medium backdrop-blur-sm border border-white/10"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loadingAi && "animate-spin text-purple-300")} />
            {loadingAi ? 'Analyzing...' : 'Refresh AI Analysis'}
          </button>
        </div>

        {/* Executive Summary */}
        <div className="mt-5 pt-5 border-t border-white/10 text-sm text-purple-100/90 leading-relaxed">
          {loadingAi ? (
            <div className="flex items-center gap-2 text-purple-200 text-xs py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              Synthesizing behavioral metrics and trend patterns...
            </div>
          ) : (
            <p className="italic">"{aiData?.executiveSummary || `Your 30-day consistency rate is ${aggregateTrajectory.rate30}%, with strongest execution during morning hours.`}"</p>
          )}
        </div>
      </div>

      {/* Top 3 Quick Diagnostic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 30-Day vs 90-Day Trajectory Pill */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">30d vs 90d Shift</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
              <span>{aggregateTrajectory.rate30}%</span>
              <span className="text-xs text-gray-400 font-normal">/ {aggregateTrajectory.rate90}%</span>
            </div>
          </div>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
            aggregateTrajectory.diff30vs90 >= 0 
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" 
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
          )}>
            {aggregateTrajectory.diff30vs90 >= 0 ? `+${aggregateTrajectory.diff30vs90}%` : `${aggregateTrajectory.diff30vs90}%`}
          </div>
        </div>

        {/* Peak Execution Window */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Peak Willpower Window</div>
            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5 truncate max-w-[150px]">
              {aiData?.timeOfDayInsight?.optimalWindow || 'Morning Slot'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Momentum Status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Habit Velocity</div>
            <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
              {improvingHabits.length > 0 ? `${improvingHabits.length} Improving` : stagnatingHabits.length > 0 ? `${stagnatingHabits.length} Stagnating` : 'Balanced Flow'}
            </div>
          </div>
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            improvingHabits.length > 0 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"
          )}>
            {improvingHabits.length > 0 ? <TrendingUp className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* 1. Which habits are most consistent? */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Most Consistent Habits</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">High anchoring rate & streak stability over 30 days</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            Top Performers
          </span>
        </div>

        {aiData?.mostConsistentAnalysis?.observation && (
          <p className="text-xs text-emerald-800 dark:text-emerald-300/90 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-xl mb-4 leading-relaxed border border-emerald-100 dark:border-emerald-900/30">
            💡 {aiData.mostConsistentAnalysis.observation}
          </p>
        )}

        <div className="space-y-2.5">
          {mostConsistentHabits.slice(0, 4).map((item, idx) => (
            <div
              key={item.habit.id}
              onClick={() => onSelectHabit(item.habit.id)}
              className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer group border border-gray-100/80 dark:border-gray-700/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  idx === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" :
                  idx === 1 ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300" :
                  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                )}>
                  #{idx + 1}
                </span>

                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: item.habit.color }}
                >
                  {getIcon(item.habit.icon)}
                </div>

                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {item.habit.name}
                  </h4>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{item.r30.completed}/{item.r30.scheduled} days done</span>
                    <span>•</span>
                    <span className="text-orange-500 font-medium">🔥 {item.streak} streak</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {item.r30.rate}%
                  </div>
                  <div className="text-[10px] text-gray-400">30d rate</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Which habits are repeatedly missed? */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Repeatedly Missed Habits</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Friction diagnostics & pattern drop-offs</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            Friction Detected
          </span>
        </div>

        {aiData?.repeatedlyMissedAnalysis?.observation && (
          <div className="text-xs text-rose-900 dark:text-rose-300/90 bg-rose-50/70 dark:bg-rose-950/30 p-3 rounded-xl mb-4 leading-relaxed border border-rose-100 dark:border-rose-900/30 space-y-1">
            <p>⚠️ {aiData.repeatedlyMissedAnalysis.observation}</p>
            {aiData.repeatedlyMissedAnalysis.actionableFix && (
              <p className="font-medium text-rose-800 dark:text-rose-200">
                🔧 Action Plan: {aiData.repeatedlyMissedAnalysis.actionableFix}
              </p>
            )}
          </div>
        )}

        {repeatedlyMissedHabits.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 text-center border border-emerald-100/50 dark:border-emerald-900/30">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              No High-Friction Habits!
            </p>
            <p className="text-[11px] text-emerald-600/90 dark:text-emerald-400/80">
              All your active scheduled habits are being maintained with healthy consistency.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {repeatedlyMissedHabits.map(item => (
              <div
                key={item.habit.id}
                onClick={() => onSelectHabit(item.habit.id)}
                className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer group border border-rose-100/60 dark:border-rose-900/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: item.habit.color }}
                  >
                    {getIcon(item.habit.icon)}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate group-hover:text-rose-600 transition-colors">
                      {item.habit.name}
                    </h4>
                    <p className="text-xs text-rose-600/90 dark:text-rose-400 truncate">
                      {item.maxMissDay >= 0 ? `Frequently skipped on ${dayNames[item.maxMissDay]}s (${item.maxMissCount}x)` : 'Missed scheduled slots'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {item.r30.rate}%
                    </div>
                    <div className="text-[10px] text-gray-400">30d rate</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. What time of day do I complete habits? (Circadian Rhythm) */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Time of Day Completion Profile</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Circadian flow & willpower distribution</p>
            </div>
          </div>
        </div>

        {aiData?.timeOfDayInsight?.observation && (
          <p className="text-xs text-indigo-900 dark:text-indigo-300/90 bg-indigo-50/70 dark:bg-indigo-950/30 p-3 rounded-xl mb-4 leading-relaxed border border-indigo-100 dark:border-indigo-900/30">
            ☀️ {aiData.timeOfDayInsight.observation}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Object.entries(timeOfDayStats).map(([key, data]) => {
            const Icon = data.icon;
            const rate = data.scheduled > 0 ? Math.round((data.completed / data.scheduled) * 100) : 0;
            return (
              <div 
                key={key} 
                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/40 text-center flex flex-col justify-between"
              >
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <Icon className="w-3.5 h-3.5 text-indigo-500" />
                  {data.label}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 truncate">
                  {data.timeSpan}
                </div>
                
                <div className="text-xl font-bold text-gray-900 dark:text-white my-1">
                  {rate}%
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mb-1.5">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${rate}%` }}
                  />
                </div>

                <div className="text-[10px] text-gray-400 dark:text-gray-500">
                  {data.completed} of {data.scheduled} done
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. How has consistency changed over 30 / 90 days? */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">30-Day vs 90-Day Trajectory</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Quarterly trendline & habit hardening rate</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedTimeframe('30')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition",
                selectedTimeframe === '30' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedTimeframe('90')}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition",
                selectedTimeframe === '90' ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              90 Days
            </button>
          </div>
        </div>

        {aiData?.consistencyTrends30vs90?.observation && (
          <p className="text-xs text-purple-900 dark:text-purple-300/90 bg-purple-50/70 dark:bg-purple-950/30 p-3 rounded-xl mb-4 leading-relaxed border border-purple-100 dark:border-purple-900/30">
            📊 {aiData.consistencyTrends30vs90.observation}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Recent 30 Days</span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{aggregateTrajectory.rate30}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-700" 
                style={{ width: `${aggregateTrajectory.rate30}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-400">
              {aggregateTrajectory.totalCompletions30} completions recorded across all habits
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">90-Day Baseline</span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{aggregateTrajectory.rate90}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-700" 
                style={{ width: `${aggregateTrajectory.rate90}%` }}
              />
            </div>
            <div className="text-[11px] text-gray-400">
              Quarterly baseline: {aggregateTrajectory.totalCompletions90} total completions
            </div>
          </div>
        </div>
      </section>

      {/* 5. Which habits are improving? & 6. Which habits are stagnating? */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Improving */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Improving Habits</h3>
              <p className="text-[11px] text-gray-400">Higher rate in last 14d than 30d baseline</p>
            </div>
          </div>

          {improvingHabits.length === 0 ? (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 text-center text-xs text-gray-500 dark:text-gray-400">
              No sudden surges yet. Habits are maintaining their regular pace.
            </div>
          ) : (
            <div className="space-y-2">
              {improvingHabits.slice(0, 3).map(item => (
                <div
                  key={item.habit.id}
                  onClick={() => onSelectHabit(item.habit.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 cursor-pointer hover:bg-emerald-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: item.habit.color }}
                    >
                      {getIcon(item.habit.icon)}
                    </div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {item.habit.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{item.momentumDelta}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Stagnating */}
        <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Stagnating Habits</h3>
              <p className="text-[11px] text-gray-400">Plateaued momentum or dormant checkmarks</p>
            </div>
          </div>

          {stagnatingHabits.length === 0 ? (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 text-center text-xs text-gray-500 dark:text-gray-400">
              Zero stagnating habits! All routines are currently engaged.
            </div>
          ) : (
            <div className="space-y-2">
              {stagnatingHabits.slice(0, 3).map(item => (
                <div
                  key={item.habit.id}
                  onClick={() => onSelectHabit(item.habit.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-900/30 cursor-pointer hover:bg-amber-50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: item.habit.color }}
                    >
                      {getIcon(item.habit.icon)}
                    </div>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {item.habit.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    {item.momentumDelta}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 7. "And much more...." Day of Week Execution Heatmap & AI Recommendations */}
      <section className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Day-of-Week Rhythm & Action Plan</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Weekly friction points & behavioral science recommendations</p>
            </div>
          </div>
        </div>

        {/* 7-Day Matrix Bars */}
        <div className="grid grid-cols-7 gap-1.5 mb-5 text-center">
          {dayOfWeekMatrix.map((d, i) => {
            const isBest = bestDay?.name === d.name && d.rate > 0;
            const isHardest = hardestDay?.name === d.name && d.rate < 100 && d.scheduled > 0;
            return (
              <div key={d.name} className="flex flex-col items-center">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                  {d.name}
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-16 rounded-xl flex items-end p-1 relative overflow-hidden">
                  <div
                    className={cn(
                      "w-full rounded-lg transition-all duration-700",
                      isBest ? "bg-emerald-500" : isHardest ? "bg-rose-400" : "bg-indigo-500"
                    )}
                    style={{ height: `${Math.max(8, d.rate)}%` }}
                  />
                </div>
                <div className="text-[10px] font-bold text-gray-800 dark:text-gray-200 mt-1">
                  {d.rate}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Smart Recommendations from AI */}
        {aiData?.smartRecommendations && aiData.smartRecommendations.length > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              AI Strategic Recommendations
            </div>
            <ul className="space-y-1.5 text-xs text-indigo-950/80 dark:text-indigo-300/80 pl-5 list-disc">
              {aiData.smartRecommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Motivational Takeaway */}
        {aiData?.motivationalTakeaway && (
          <div className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500 italic">
            "{aiData.motivationalTakeaway}"
          </div>
        )}
      </section>
    </div>
  );
};
