import { addDays, startOfWeek } from '../data/plans';
import {
  Exercise, ExerciseMetric, ExerciseProgress, ExerciseProgressPoint, MuscleGroup,
  PersonalRecord, ProgressTimeframe, WorkoutExerciseState, WorkoutLog, WorkoutSet,
} from '../types';
import { calculateSetVolume, formatDuration, formatMetricNumber, getEntryMetric, isValidSetPerformance } from './metrics';
import { calculateWorkoutVolume } from './workouts';

const millisecondsPerDay = 86_400_000;
const timeframeDays: Record<Exclude<ProgressTimeframe, 'all'>, number> = {
  '1m': 30, '3m': 90, '6m': 180, '1y': 365,
};

export function calculateEstimated1Rm(weightKg: number, reps: number): number {
  return weightKg <= 0 || reps <= 0 ? 0 : weightKg * (1 + reps / 30);
}

export function getWorkingSets(sets: WorkoutSet[], metric?: ExerciseMetric): WorkoutSet[] {
  return sets.filter((set) => set.done && set.type !== 'warmup' && (metric === undefined || isValidSetPerformance(set, metric)));
}

function matchingEntry(candidate: WorkoutExerciseState, current: WorkoutExerciseState): boolean {
  return candidate.exerciseId === current.exerciseId && getEntryMetric(candidate) === getEntryMetric(current)
    && candidate.machineMemoryId === current.machineMemoryId;
}

export function calculatePersonalRecords(
  currentEntries: WorkoutExerciseState[], previousLogs: WorkoutLog[], userId: string,
): PersonalRecord[] {
  const grouped = new Map<string, WorkoutExerciseState>();
  for (const entry of currentEntries) {
    const key = `${entry.exerciseId}:${getEntryMetric(entry)}:${entry.machineMemoryId ?? ''}`;
    const previous = grouped.get(key);
    grouped.set(key, previous ? { ...entry, sets: [...previous.sets, ...entry.sets] } : entry);
  }
  return [...grouped.values()].flatMap((entry) => {
    const metric = getEntryMetric(entry);
    const currentSets = getWorkingSets(entry.sets, metric);
    if (!currentSets.length) return [];
    const userLogs = previousLogs.filter((log) => log.userId === userId);
    const previousSets = userLogs.flatMap((log) => log.entries.filter((candidate) => matchingEntry(candidate, entry)))
      .flatMap((candidate) => getWorkingSets(candidate.sets, metric));
    const records: PersonalRecord[] = [];
    const addMaximum = (type: PersonalRecord['type'], getValue: (set: WorkoutSet) => number) => {
      const best = maxSetBy(currentSets, getValue);
      const previousValue = maxValue(previousSets, getValue);
      if (best && getValue(best) > previousValue) records.push(createSetRecord(type, entry.exerciseId, best, getValue(best), previousValue));
    };
    if (metric === 'duration') {
      addMaximum('longest_duration', (set) => set.durationSeconds ?? 0);
      return records;
    }
    if (metric === 'distance_duration') {
      addMaximum('longest_distance', (set) => set.distanceKm ?? 0);
      return records;
    }
    if (metric === 'reps') {
      addMaximum('most_reps', (set) => set.reps);
      return records;
    }
    if (metric === 'assisted_reps') {
      // A lower assistance value improves only when the rep count is maintained.
      const improvements = currentSets.filter((set) => set.reps > 0).flatMap((set) => {
        const comparable = previousSets.filter((previous) => previous.reps <= set.reps);
        const dominated = previousSets.some((previous) => previous.reps >= set.reps && previous.weightKg <= set.weightKg);
        const previousAssistance = comparable.length ? Math.min(...comparable.map((previous) => previous.weightKg)) : undefined;
        return !dominated && previousAssistance !== undefined && set.weightKg < previousAssistance
          ? [{ set, previousAssistance }] : [];
      });
      const best = improvements.sort((a, b) =>
        (b.previousAssistance - b.set.weightKg) - (a.previousAssistance - a.set.weightKg))[0];
      if (best) records.push(createSetRecord('least_assistance', entry.exerciseId, best.set, best.set.weightKg, best.previousAssistance));
      const repRecord = findBestRepsAtWeightRecord(currentSets, previousSets, true);
      if (repRecord) records.push(createSetRecord('reps_at_weight', entry.exerciseId, repRecord.set, repRecord.set.reps, repRecord.previousReps));
      return records;
    }
    addMaximum('highest_weight', (set) => set.weightKg);
    const repRecord = findBestRepsAtWeightRecord(currentSets, previousSets);
    if (repRecord) records.push(createSetRecord('reps_at_weight', entry.exerciseId, repRecord.set, repRecord.set.reps, repRecord.previousReps));
    addMaximum('estimated_1rm', (set) => calculateEstimated1Rm(set.weightKg, set.reps));
    addMaximum('set_volume', (set) => calculateSetVolume(set, metric));
    const sessionVolume = currentSets.reduce((sum, set) => sum + calculateSetVolume(set, metric), 0);
    const previousVolume = maxValue(userLogs, (log) => log.entries.filter((candidate) => matchingEntry(candidate, entry))
      .flatMap((candidate) => getWorkingSets(candidate.sets, metric)).reduce((sum, set) => sum + calculateSetVolume(set, metric), 0));
    if (sessionVolume > previousVolume) records.push({ type: 'exercise_session_volume', exerciseId: entry.exerciseId, value: sessionVolume, previousValue: previousVolume });
    return records;
  });
}

export function buildExerciseProgress(
  logs: WorkoutLog[], userId: string, exerciseId: string, timeframe: ProgressTimeframe, now: number,
  machineMemoryId?: string, selectedMetric?: ExerciseMetric,
): ExerciseProgress {
  const cutoff = timeframe === 'all' ? Number.NEGATIVE_INFINITY : now - timeframeDays[timeframe] * millisecondsPerDay;
  const relevantLogs = logs.filter((log) => log.userId === userId && log.startedAt >= cutoff && log.startedAt <= now);
  const latestEntry = [...relevantLogs].sort((a, b) => b.startedAt - a.startedAt).flatMap((log) => log.entries)
    .find((entry) => entry.exerciseId === exerciseId && entry.machineMemoryId === machineMemoryId);
  const currentMetric = selectedMetric ?? (latestEntry ? getEntryMetric(latestEntry) : getEntryMetric({ id: '', exerciseId, sets: [] }));
  const points = relevantLogs
    .map((log): ExerciseProgressPoint | null => {
      const entries = log.entries.filter((entry) => entry.exerciseId === exerciseId && entry.machineMemoryId === machineMemoryId && getEntryMetric(entry) === currentMetric);
      const workingSets = entries.flatMap((entry) => getWorkingSets(entry.sets, currentMetric));
      if (!workingSets.length) return null;
      const metric = getEntryMetric(entries[0]);
      return {
        logId: log.id, date: log.date, timestamp: log.startedAt, metric,
        maxWeightKg: metric === 'weight_reps' ? maxValue(workingSets, (set) => set.weightKg) : 0,
        estimated1RmKg: metric === 'weight_reps' ? maxValue(workingSets, (set) => calculateEstimated1Rm(set.weightKg, set.reps)) : 0,
        volumeKg: workingSets.reduce((sum, set) => sum + calculateSetVolume(set, metric), 0),
        bestReps: maxValue(workingSets, (set) => set.reps),
        longestDurationSeconds: maxValue(workingSets, (set) => set.durationSeconds ?? 0),
        longestDistanceKm: maxValue(workingSets, (set) => set.distanceKm ?? 0),
        minAssistanceKg: metric === 'assisted_reps' ? Math.min(...workingSets.map((set) => set.weightKg)) : undefined,
        workingSets,
      };
    }).filter((point): point is ExerciseProgressPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
  const windowDays = timeframe === 'all' ? Math.max(7, (now - (points[0]?.timestamp ?? now)) / millisecondsPerDay) : timeframeDays[timeframe];
  return {
    points, lastPerformance: points.at(-1) ?? null, metric: points.at(-1)?.metric,
    bestWeightKg: maxValue(points, (point) => point.maxWeightKg),
    bestEstimated1RmKg: maxValue(points, (point) => point.estimated1RmKg),
    bestSessionVolumeKg: maxValue(points, (point) => point.volumeKg),
    bestReps: maxValue(points, (point) => point.bestReps ?? 0),
    longestDurationSeconds: maxValue(points, (point) => point.longestDurationSeconds ?? 0),
    longestDistanceKm: maxValue(points, (point) => point.longestDistanceKm ?? 0),
    minAssistanceKg: points.some((point) => point.minAssistanceKg !== undefined)
      ? Math.min(...points.flatMap((point) => point.minAssistanceKg === undefined ? [] : [point.minAssistanceKg])) : undefined,
    sessionsPerWeek: points.length / Math.max(1, windowDays / 7),
  };
}

export type ProgressionRecommendation = {
  exerciseId: string;
  action: 'increase' | 'hold' | 'reduce';
  message: string;
  suggestedWeightKg?: number;
  suggestedReps?: number;
  suggestedDurationSeconds?: number;
  suggestedDistanceKm?: number;
};

export function getProgressionRecommendation(
  entry: WorkoutExerciseState, previousLogs: WorkoutLog[], userId: string,
): ProgressionRecommendation | null {
  const metric = getEntryMetric(entry);
  const lastEntry = [...previousLogs].filter((log) => log.userId === userId)
    .sort((a, b) => b.startedAt - a.startedAt)
    .flatMap((log) => log.entries.filter((candidate) => matchingEntry(candidate, entry)))
    .find((candidate) => getWorkingSets(candidate.sets, metric).length > 0);
  if (!lastEntry) return null;
  const sets = getWorkingSets(lastEntry.sets, metric);
  const plannedWorkingSets = entry.sets.filter((set) => set.type !== 'warmup').length;
  const completedPlannedVolume = sets.length >= Math.max(1, plannedWorkingSets);
  const target = entry.sets.find((set) => set.type !== 'warmup');
  const upper = target?.repRangeMax ?? target?.targetReps ?? 12;
  const lower = target?.repRangeMin ?? Math.max(1, upper - 2);
  const targetRir = target?.targetRir ?? 1;
  const effortless = sets.every((set) => (set.rir ?? (set.rpe === undefined ? targetRir : 10 - set.rpe)) >= targetRir);
  const ready = completedPlannedVolume && sets.every((set) => set.reps >= upper) && effortless;
  const struggling = sets.every((set) => set.reps < lower) || sets.some((set) => (set.rir ?? 10) === 0 || (set.rpe ?? 0) >= 10);
  const weight = Math.min(...sets.map((set) => set.weightKg));
  const base = { exerciseId: entry.exerciseId };
  if (metric === 'duration') {
    const duration = Math.min(...sets.map((set) => set.durationSeconds ?? 0));
    const increase = completedPlannedVolume && effortless;
    return { ...base, action: increase ? 'increase' : 'hold', suggestedDurationSeconds: duration + (increase ? 5 : 0), message: increase ? `All planned holds completed. Try ${formatDuration(duration + 5)} next time (+5 seconds).` : !completedPlannedVolume ? 'Last session completed fewer holds than currently planned. Repeat the duration and complete every planned hold before increasing.' : 'Repeat the last duration until it feels controlled.' };
  }
  if (metric === 'distance_duration') return { ...base, action: 'hold', message: 'Repeat the last distance and time; compare pace at the same distance before increasing.' };
  if (ready) {
    if (metric === 'reps') return { ...base, action: 'increase', suggestedReps: upper + 1, message: `All sets reached ${upper} reps. Try ${upper + 1} reps next time.` };
    const nextWeight = metric === 'assisted_reps' ? Math.max(0, weight - 2.5) : weight + 2.5;
    return { ...base, action: 'increase', suggestedWeightKg: nextWeight, suggestedReps: lower, message: `All sets reached ${upper} reps${target?.targetRir === undefined ? '' : ` at RIR ${targetRir}+`}. Try ${nextWeight} kg${metric === 'assisted_reps' ? ' assistance' : ''} and ${lower} reps; adjust to your equipment's next available step.` };
  }
  if (struggling && metric !== 'reps') {
    const nextWeight = metric === 'assisted_reps' ? weight + 2.5 : Math.max(0, Math.round(weight * 0.95 * 2) / 2);
    return { ...base, action: 'reduce', suggestedWeightKg: nextWeight, message: `Last session missed the target or reached maximum effort. Try ${nextWeight} kg${metric === 'assisted_reps' ? ' assistance' : ''} and rebuild within ${lower}–${upper} reps.` };
  }
  return { ...base, action: 'hold', suggestedWeightKg: metric === 'reps' ? undefined : weight, message: !completedPlannedVolume ? `Last session completed ${sets.length} of the ${plannedWorkingSets} working sets currently planned. Complete the full target before increasing.` : `Keep the same ${metric === 'reps' ? 'exercise' : 'load'} and work toward ${upper} reps on every set. Last session has not yet met the full target.` };
}

export const buildProgressionRecommendation = getProgressionRecommendation;

export function applyProgressionRecommendation(entry: WorkoutExerciseState, recommendation: ProgressionRecommendation): WorkoutExerciseState {
  if (entry.exerciseId !== recommendation.exerciseId) return entry;
  return { ...entry, sets: entry.sets.map((set) => set.done || set.type === 'warmup' ? set : {
    ...set,
    weightKg: recommendation.suggestedWeightKg ?? set.weightKg,
    reps: recommendation.suggestedReps ?? set.reps,
    durationSeconds: recommendation.suggestedDurationSeconds ?? set.durationSeconds,
    distanceKm: recommendation.suggestedDistanceKm ?? set.distanceKm,
  }) };
}

export type WeeklySummary = {
  weekStart: string; weekEnd: string; workoutCount: number; previousWorkoutCount: number;
  completedSets: number; totalDurationSeconds: number; volumeKg: number;
  muscleSets: { muscle: MuscleGroup; sets: number }[];
};

export function getWeeklySummary(logs: WorkoutLog[], exercises: Exercise[], userId: string, dateIso: string): WeeklySummary {
  const weekStart = startOfWeek(dateIso);
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const userLogs = logs.filter((log) => log.userId === userId);
  const weekLogs = userLogs.filter((log) => log.date >= weekStart && log.date <= weekEnd);
  const muscleCounts = new Map<MuscleGroup, number>();
  let completedSets = 0;
  for (const log of weekLogs) for (const entry of log.entries) {
    const workingSets = getWorkingSets(entry.sets, getEntryMetric(entry));
    completedSets += workingSets.length;
    const exercise = exercises.find((item) => item.id === entry.exerciseId);
    if (exercise && workingSets.length) muscleCounts.set(exercise.primaryMuscle, (muscleCounts.get(exercise.primaryMuscle) ?? 0) + workingSets.length);
  }
  return {
    weekStart, weekEnd, workoutCount: weekLogs.length,
    previousWorkoutCount: userLogs.filter((log) => log.date >= previousStart && log.date < weekStart).length,
    completedSets, volumeKg: weekLogs.reduce((sum, log) => sum + calculateWorkoutVolume(log.entries), 0), totalDurationSeconds: weekLogs.reduce((sum, log) => sum + log.durationSeconds, 0),
    muscleSets: [...muscleCounts].map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets),
  };
}

export const buildWeeklySummary = getWeeklySummary;

export function formatPersonalRecord(record: PersonalRecord): string {
  switch (record.type) {
    case 'highest_weight': return `Weight PR · ${formatMetricNumber(record.value)} kg`;
    case 'reps_at_weight': return `Rep PR · ${record.reps} reps at ${record.weightKg} kg`;
    case 'most_reps': return `Rep PR · ${record.value} reps`;
    case 'longest_duration': return `Hold PR · ${formatDuration(record.value)}`;
    case 'longest_distance': return `Distance PR · ${formatMetricNumber(record.value)} km`;
    case 'least_assistance': return `Assistance PR · ${record.weightKg} kg × ${record.reps} (was ${record.previousValue} kg assistance)`;
    case 'estimated_1rm': return `Estimated 1RM PR · ${formatMetricNumber(record.value)} kg`;
    case 'set_volume': return `Set volume PR · ${formatMetricNumber(record.value)} kg`;
    case 'exercise_session_volume': return `Session volume PR · ${formatMetricNumber(record.value)} kg`;
  }
}

function maxValue<T>(items: T[], getValue: (item: T) => number): number {
  return items.reduce((best, item) => Math.max(best, getValue(item)), 0);
}
function maxSetBy(sets: WorkoutSet[], getValue: (set: WorkoutSet) => number): WorkoutSet | null {
  return sets.reduce<WorkoutSet | null>((best, set) => !best || getValue(set) > getValue(best) ? set : best, null);
}
function createSetRecord(type: PersonalRecord['type'], exerciseId: string, set: WorkoutSet, value: number, previousValue: number): PersonalRecord {
  return { type, exerciseId, setId: set.id, value, previousValue, weightKg: set.weightKg, reps: set.reps };
}
function findBestRepsAtWeightRecord(currentSets: WorkoutSet[], previousSets: WorkoutSet[], requirePrevious = false) {
  return currentSets.reduce<{ set: WorkoutSet; previousReps: number } | null>((best, set) => {
    const matching = previousSets.filter((previous) => previous.weightKg === set.weightKg);
    if (requirePrevious && !matching.length) return best;
    if (!matching.length && previousSets.some((previous) => previous.weightKg >= set.weightKg && previous.reps >= set.reps)) return best;
    const previousReps = maxValue(matching, (previous) => previous.reps);
    if (set.reps <= previousReps) return best;
    const bestHasPrevious = best ? previousSets.some((previous) => previous.weightKg === best.set.weightKg) : false;
    if ((matching.length > 0) !== bestHasPrevious) return matching.length ? { set, previousReps } : best;
    return set.reps - previousReps > (best ? best.set.reps - best.previousReps : -1) ? { set, previousReps } : best;
  }, null);
}
