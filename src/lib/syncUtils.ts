import { Habit, JournalEntry } from '../types';

/**
 * Merges a single habit using Last-Write-Wins Element-Set (LWW-Element-Set) CRDT logic
 * for habit completion dates (done / not done).
 */
export function mergeHabit(localH: Habit, remoteH: Habit): Habit {
  if (localH.id !== remoteH.id) return remoteH;

  // Decide base metadata: pick whichever has the more recent updatedAt timestamp
  const localUpdated = localH.updatedAt || 0;
  const remoteUpdated = remoteH.updatedAt || 0;
  const base = remoteUpdated >= localUpdated ? remoteH : localH;

  // 1. CRDT LWW-Element-Set for completed dates
  const localCompletedAt: Record<string, number> = { ...(localH.completedAt || {}) };
  const remoteCompletedAt: Record<string, number> = { ...(remoteH.completedAt || {}) };
  const localUncompletedAt: Record<string, number> = { ...(localH.uncompletedAt || {}) };
  const remoteUncompletedAt: Record<string, number> = { ...(remoteH.uncompletedAt || {}) };

  // Support legacy dates: If any habit has dates without timestamps,
  // assign timestamp based on habit update time or baseline so completions are preserved
  for (const d of (localH.dates || [])) {
    if (!localCompletedAt[d]) {
      localCompletedAt[d] = localUpdated || 1;
    }
  }
  for (const d of (remoteH.dates || [])) {
    if (!remoteCompletedAt[d]) {
      remoteCompletedAt[d] = remoteUpdated || 1;
    }
  }

  // Merge completion timestamps: max timestamp wins
  const mergedCompletedAt: Record<string, number> = { ...remoteCompletedAt };
  for (const [d, ts] of Object.entries(localCompletedAt)) {
    mergedCompletedAt[d] = Math.max(mergedCompletedAt[d] || 0, ts);
  }

  // Merge uncompletion timestamps: max timestamp wins
  const mergedUncompletedAt: Record<string, number> = { ...remoteUncompletedAt };
  for (const [d, ts] of Object.entries(localUncompletedAt)) {
    mergedUncompletedAt[d] = Math.max(mergedUncompletedAt[d] || 0, ts);
  }

  const localDatesSet = new Set(localH.dates || []);
  const remoteDatesSet = new Set(remoteH.dates || []);

  const allCandidateDates = new Set([
    ...Object.keys(mergedCompletedAt),
    ...Object.keys(mergedUncompletedAt),
    ...localDatesSet,
    ...remoteDatesSet
  ]);

  // Include candidate dates from progress maps where progress exists
  for (const [d, val] of Object.entries(localH.progress || {})) {
    if (val > 0) allCandidateDates.add(d);
  }
  for (const [d, val] of Object.entries(remoteH.progress || {})) {
    if (val > 0) allCandidateDates.add(d);
  }

  const finalDates: string[] = [];
  for (const d of allCandidateDates) {
    const cTs = mergedCompletedAt[d] || 0;
    const uTs = mergedUncompletedAt[d] || 0;

    // If explicitly uncompleted after or at the time of completion, exclude it
    if (uTs > 0 && uTs >= cTs) {
      continue;
    }

    // Otherwise, include if completion is newer, or if present in either device's dates/progress and never uncompleted
    if (cTs > uTs) {
      finalDates.push(d);
    } else if (uTs === 0 && (localDatesSet.has(d) || remoteDatesSet.has(d) || (localH.progress?.[d] || 0) > 0 || (remoteH.progress?.[d] || 0) > 0)) {
      finalDates.push(d);
    }
  }
  finalDates.sort();

  // 2. Progress map: merge by taking the maximum progress for each date,
  // while ensuring completed dates have at least the base progress or target
  const mergedProgress: Record<string, number> = {};
  const allProgressDates = new Set([
    ...Object.keys(localH.progress || {}),
    ...Object.keys(remoteH.progress || {})
  ]);
  for (const d of allProgressDates) {
    const locP = localH.progress?.[d] || 0;
    const remP = remoteH.progress?.[d] || 0;
    const maxP = Math.max(locP, remP);
    if (finalDates.includes(d)) {
      mergedProgress[d] = maxP > 0 ? maxP : (base.progress?.[d] || 1);
    } else {
      const uTs = mergedUncompletedAt[d] || 0;
      const cTs = mergedCompletedAt[d] || 0;
      if (uTs >= cTs && uTs > 0) {
        mergedProgress[d] = 0;
      } else {
        mergedProgress[d] = maxP;
      }
    }
  }

  // Ensure every completed date has at least progress 1
  for (const d of finalDates) {
    if (!mergedProgress[d] || mergedProgress[d] <= 0) {
      mergedProgress[d] = 1;
    }
  }

  // Ensure scheduleHistory is retained
  let scheduleHistory = base.scheduleHistory;
  if (!scheduleHistory || scheduleHistory.length === 0) {
    scheduleHistory = (localH.scheduleHistory && localH.scheduleHistory.length > 0)
      ? localH.scheduleHistory
      : (remoteH.scheduleHistory || []);
  }

  return {
    ...base,
    dates: finalDates,
    progress: mergedProgress,
    completedAt: mergedCompletedAt,
    uncompletedAt: mergedUncompletedAt,
    scheduleHistory: scheduleHistory || [],
    updatedAt: Math.max(localUpdated, remoteUpdated, Date.now())
  };
}

/**
 * Merges two lists of habits:
 * - Habits present in both lists have their metadata and completions merged cleanly.
 * - Habits present in only one list are retained.
 */
export function mergeHabitLists(localList: Habit[] = [], remoteList: Habit[] = []): Habit[] {
  const result: Habit[] = [];
  const remoteMap = new Map((remoteList || []).map(h => [h.id, h]));
  const localMap = new Map((localList || []).map(h => [h.id, h]));

  // Merge habits from remote
  for (const remoteH of (remoteList || [])) {
    const localH = localMap.get(remoteH.id);
    if (localH) {
      result.push(mergeHabit(localH, remoteH));
    } else {
      result.push({
        ...remoteH,
        dates: remoteH.dates || [],
        progress: remoteH.progress || {},
        completedAt: remoteH.completedAt || {},
        uncompletedAt: remoteH.uncompletedAt || {}
      });
    }
  }

  // Retain local-only habits (e.g. newly created on this device while offline or before sync)
  for (const localH of (localList || [])) {
    if (!remoteMap.has(localH.id)) {
      result.push({
        ...localH,
        dates: localH.dates || [],
        progress: localH.progress || {},
        completedAt: localH.completedAt || {},
        uncompletedAt: localH.uncompletedAt || {}
      });
    }
  }

  return result;
}

/**
 * Merges two lists of journal entries:
 * - Preserves all unique entries.
 * - For matching IDs, picks the most recently edited entry.
 */
export function mergeJournalLists(localList: JournalEntry[] = [], remoteList: JournalEntry[] = []): JournalEntry[] {
  const map = new Map<string, JournalEntry>();
  for (const entry of (remoteList || [])) {
    map.set(entry.id, entry);
  }
  for (const entry of (localList || [])) {
    const existing = map.get(entry.id);
    if (!existing) {
      map.set(entry.id, entry);
    } else {
      const exTime = existing.createdAt || 0;
      const curTime = entry.createdAt || 0;
      if (curTime > exTime) {
        map.set(entry.id, entry);
      }
    }
  }
  return Array.from(map.values());
}
