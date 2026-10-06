import { Exercise, ExerciseMetric, WorkoutExerciseState, WorkoutSet } from '../types';

const legacyMetrics: Record<string, ExerciseMetric> = {
  plank: 'duration',
  'treadmill-walk': 'distance_duration',
  'assisted-pull-up': 'assisted_reps',
  crunch: 'reps',
  'leg-raise': 'reps',
};

export function getExerciseMetric(exercise: Exercise): ExerciseMetric {
  if (exercise.metric) return exercise.metric;
  if (legacyMetrics[exercise.id]) return legacyMetrics[exercise.id];
  if (exercise.movementType === 'isometric') return 'duration';
  if (exercise.category === 'cardio') return 'distance_duration';
  if (exercise.weightMode === 'bodyweight') return 'reps';
  return 'weight_reps';
}

export function getEntryMetric(entry: WorkoutExerciseState): ExerciseMetric {
  return entry.metric ?? legacyMetrics[entry.exerciseId] ?? 'weight_reps';
}

export function calculateSetVolume(set: WorkoutSet, metric: ExerciseMetric): number {
  return metric === 'weight_reps' ? Math.max(0, set.weightKg) * Math.max(0, set.reps) : 0;
}

/** A completed checkbox alone cannot establish a measured performance or personal record. */
export function isValidSetPerformance(set: WorkoutSet, metric: ExerciseMetric): boolean {
  const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0;
  if (metric === 'duration') return positive(set.durationSeconds);
  if (metric === 'distance_duration') return positive(set.durationSeconds) && positive(set.distanceKm);
  if (!positive(set.reps) || !Number.isInteger(set.reps)) return false;
  return metric === 'reps' || (Number.isFinite(set.weightKg) && set.weightKg >= 0);
}

export function formatSetPerformance(set: WorkoutSet, metric: ExerciseMetric): string {
  const effort = set.rir !== undefined ? ` · RIR ${set.rir}` : set.rpe !== undefined ? ` · RPE ${set.rpe}` : '';
  switch (metric) {
    case 'duration': return `${formatDuration(set.durationSeconds ?? 0)}${effort}`;
    case 'distance_duration': return `${formatMetricNumber(set.distanceKm ?? 0)} km · ${formatDuration(set.durationSeconds ?? 0)}${effort}`;
    case 'reps': return `${set.reps} reps${effort}`;
    case 'assisted_reps': return `${formatMetricNumber(set.weightKg)} kg assistance × ${set.reps}${effort}`;
    default: return `${formatMetricNumber(set.weightKg)} kg × ${set.reps}${effort}`;
  }
}

export function formatMetricNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Math.round(value * 100) / 100}`;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

/** Normalize user-edited metric values in one place before persisting a set. */
export function normalizeWorkoutSet(set: WorkoutSet, metric: ExerciseMetric): WorkoutSet {
  const finite = (value: number | undefined, maximum = Number.MAX_SAFE_INTEGER) =>
    value === undefined ? undefined : Math.min(maximum, Math.max(0, Number.isFinite(value) ? value : 0));
  const lower = finite(set.repRangeMin);
  const upper = finite(set.repRangeMax);
  return {
    ...set,
    weightKg: metric === 'weight_reps' || metric === 'assisted_reps' ? finite(set.weightKg) ?? 0 : 0,
    reps: metric === 'duration' || metric === 'distance_duration' ? 0 : Math.round(finite(set.reps) ?? 0),
    targetReps: Math.round(finite(set.targetReps) ?? 0),
    durationSeconds: metric === 'duration' || metric === 'distance_duration' ? Math.round(finite(set.durationSeconds) ?? 0) : undefined,
    distanceKm: metric === 'distance_duration' ? finite(set.distanceKm) ?? 0 : undefined,
    rir: finite(set.rir, 10),
    rpe: set.rpe === undefined ? undefined : Math.max(1, finite(set.rpe, 10) ?? 1),
    targetRir: finite(set.targetRir, 10),
    repRangeMin: lower === undefined ? undefined : Math.round(lower),
    repRangeMax: upper === undefined ? undefined : Math.round(Math.max(lower ?? 0, upper)),
  };
}
