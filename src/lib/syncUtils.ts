import { Habit, JournalEntry, JournalSettings } from '../types';

/**
 * Merges two sets of habits (local and remote) non-destructively:
 * - Completed dates are unioned, ensuring no completion from any device is erased.
 * - Progress values are intelligently merged (max value per date, respecting newer explicit unchecks).
 * - Metadata (name, color, icon, targetDays, etc.) is taken from whichever has the newer timestamp.
 * - Preserves habits created on either device unless explicitly deleted in deletedIds.
 */
export function mergeHabits(
  local: Habit[],
  remote: Habit[],
  deletedIds: string[] = []
): Habit[] {
  const deletedSet = new Set(deletedIds);
  const map = new Map<string, Habit>();

  // 1. Process remote habits first
  for (const r of remote || []) {
    if (!r || !r.id || deletedSet.has(r.id)) continue;
    map.set(r.id, { ...r });
  }

  // 2. Process local habits and merge
  for (const l of local || []) {
    if (!l || !l.id || deletedSet.has(l.id)) continue;

    const r = map.get(l.id);
    if (!r) {
      // Habit exists only locally (created on this device)
      map.set(l.id, { ...l });
    } else {
      // Habit exists in BOTH local and remote.
      const lDates = Array.isArray(l.dates) ? l.dates : [];
      const rDates = Array.isArray(r.dates) ? r.dates : [];

      const lUpdated = l.updatedAt || 0;
      const rUpdated = r.updatedAt || 0;

      // Merge progress:
      const lProgress = l.progress || {};
      const rProgress = r.progress || {};
      const allProgressDates = new Set([...Object.keys(lProgress), ...Object.keys(rProgress)]);
      const mergedProgress: Record<string, number> = {};

      for (const d of allProgressDates) {
        const lp = lProgress[d] ?? 0;
        const rp = rProgress[d] ?? 0;
        // If one device explicitly set 0 with a strictly newer timestamp, honor that uncheck
        if (lUpdated > rUpdated && lProgress[d] !== undefined) {
          mergedProgress[d] = lp;
        } else if (rUpdated > lUpdated && rProgress[d] !== undefined) {
          mergedProgress[d] = rp;
        } else {
          mergedProgress[d] = Math.max(lp, rp);
        }
      }

      // Merge dates
      const mergedDatesSet = new Set<string>();
      for (const d of lDates) {
        if (rUpdated > lUpdated && rProgress[d] === 0 && !rDates.includes(d)) {
          // Remote unchecked it more recently
          continue;
        }
        mergedDatesSet.add(d);
      }
      for (const d of rDates) {
        if (lUpdated > rUpdated && lProgress[d] === 0 && !lDates.includes(d)) {
          // Local unchecked it more recently
          continue;
        }
        mergedDatesSet.add(d);
      }
      // Also add any dates with positive progress
      for (const [d, val] of Object.entries(mergedProgress)) {
        if (val > 0) mergedDatesSet.add(d);
      }

      // Merge frozen dates
      const mergedFrozenDates = Array.from(new Set([
        ...(l.frozenDates || []),
        ...(r.frozenDates || [])
      ]));

      // Merge schedule history: deduplicate by effectiveFrom
      const combinedSchedules = [
        ...(l.scheduleHistory || []),
        ...(r.scheduleHistory || [])
      ];
      const schedMap = new Map<string, any>();
      for (const s of combinedSchedules) {
        if (s && s.effectiveFrom) {
          schedMap.set(s.effectiveFrom, s);
        }
      }
      const mergedSchedule = Array.from(schedMap.values()).sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom)
      );

      // Take whichever has newer metadata (name, color, icon, reminderTime, etc.)
      const base = lUpdated >= rUpdated ? l : r;

      map.set(l.id, {
        ...base,
        dates: Array.from(mergedDatesSet),
        progress: mergedProgress,
        frozenDates: mergedFrozenDates,
        scheduleHistory: mergedSchedule.length > 0 ? mergedSchedule : (base.scheduleHistory || []),
        updatedAt: Math.max(lUpdated, rUpdated, Date.now())
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Merges two sets of journal entries (local and remote) non-destructively:
 * - Retains entries from both devices.
 * - If an entry exists in both, keeps the version with the newer updatedAt or createdAt.
 * - Does not resurrect deleted entries in deletedIds.
 */
export function mergeJournal(
  local: JournalEntry[],
  remote: JournalEntry[],
  deletedIds: string[] = []
): JournalEntry[] {
  const deletedSet = new Set(deletedIds);
  const map = new Map<string, JournalEntry>();

  for (const r of remote || []) {
    if (!r || !r.id || deletedSet.has(r.id)) continue;
    map.set(r.id, { ...r });
  }

  for (const l of local || []) {
    if (!l || !l.id || deletedSet.has(l.id)) continue;
    const r = map.get(l.id);
    if (!r) {
      map.set(l.id, { ...l });
    } else {
      const lTime = l.updatedAt || l.createdAt || 0;
      const rTime = r.updatedAt || r.createdAt || 0;
      map.set(l.id, lTime >= rTime ? l : r);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * Strips undefined properties recursively so Firestore does not reject writes.
 */
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
