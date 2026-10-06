import { WorkoutLog, WorkoutSet } from '../types';
import { calculateWorkoutVolume } from './workouts';
import { getEntryMetric, normalizeWorkoutSet } from './metrics';
import { calculatePersonalRecords } from './progress';

export type WorkoutLogEdit = Partial<Pick<WorkoutLog, 'name' | 'notes' | 'date' | 'durationSeconds' | 'entries'>>;

export function isValidWorkoutDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Keep metadata and all derived statistics consistent whenever history changes. */
export function editWorkoutLog(log: WorkoutLog, edit: WorkoutLogEdit): WorkoutLog {
  const next = { ...log, ...edit };
  if (!isValidWorkoutDate(next.date)) throw new Error('Enter a valid date in YYYY-MM-DD format.');
  if (!next.name.trim()) throw new Error('Workout name cannot be empty.');
  if (!Number.isFinite(next.durationSeconds) || next.durationSeconds < 0) throw new Error('Workout duration must be a positive number or zero.');
  for (const entry of next.entries) for (const set of entry.sets) {
    const numbers = [set.weightKg, set.reps, set.targetReps, set.durationSeconds, set.distanceKm, set.rir, set.rpe, set.repRangeMin, set.repRangeMax, set.targetRir];
    if (numbers.some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new Error('Set values must be valid, non-negative numbers.');
    if ((set.rir ?? 0) > 10 || (set.targetRir ?? 0) > 10 || (set.rpe !== undefined && (set.rpe < 1 || set.rpe > 10))) throw new Error('RIR must be 0–10 and RPE 1–10.');
    if (set.repRangeMin !== undefined && set.repRangeMax !== undefined && set.repRangeMin > set.repRangeMax) throw new Error('Rep range minimum cannot exceed its maximum.');
  }
  const started = new Date(log.startedAt);
  if (next.date !== log.date) {
    const [year, month, day] = next.date.split('-').map(Number);
    started.setFullYear(year, month - 1, day);
  }
  const durationSeconds = Math.round(next.durationSeconds);
  const entries = next.entries.map((entry) => ({
    ...entry,
    metric: getEntryMetric(entry),
    sets: entry.sets.map((set) => normalizeWorkoutSet(set, getEntryMetric(entry))),
  }));
  return {
    ...next, name: next.name.trim(), dayId: next.date !== log.date ? next.date : log.dayId, startedAt: started.getTime(),
    finishedAt: started.getTime() + durationSeconds * 1000,
    durationSeconds, entries, volumeKg: calculateWorkoutVolume(entries),
  };
}

export function updateHistorySet(log: WorkoutLog, entryId: string, setId: string, edit: Partial<WorkoutSet>): WorkoutLog {
  return editWorkoutLog(log, {
    entries: log.entries.map((entry) => entry.id !== entryId ? entry : {
      ...entry, sets: entry.sets.map((set) => set.id !== setId ? set : { ...set, ...edit, id: set.id, workoutExerciseId: set.workoutExerciseId }),
    }),
  });
}

export function getHistoryPersonalRecords(log: WorkoutLog, logs: WorkoutLog[]) {
  return calculatePersonalRecords(log.entries, logs.filter((previous) => previous.id !== log.id && previous.startedAt < log.startedAt), log.userId);
}
