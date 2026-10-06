import { describe, expect, it } from 'vitest';
import { exerciseDb } from '../data/exercises';
import { ExerciseMetric, WorkoutSet } from '../types';
import { calculateSetVolume, formatSetPerformance, getEntryMetric, getExerciseMetric, isValidSetPerformance, normalizeWorkoutSet } from './metrics';

const set: WorkoutSet = { id: 'set', workoutExerciseId: 'entry', type: 'normal', done: true, targetReps: 10, reps: 10, weightKg: 40, durationSeconds: 75, distanceKm: 1.25, createdAt: 1 };

describe('exercise metrics', () => {
  it('infers historical and built-in metrics while respecting explicit custom metrics', () => {
    expect(getEntryMetric({ id: 'entry', exerciseId: 'assisted-pull-up', sets: [] })).toBe('assisted_reps');
    expect(getExerciseMetric(exerciseDb.find((exercise) => exercise.id === 'plank')!)).toBe('duration');
    expect(getExerciseMetric({ ...exerciseDb[0], metric: 'reps' })).toBe('reps');
  });
  it('counts volume only for external weight and repetitions', () => {
    expect(calculateSetVolume(set, 'weight_reps')).toBe(400);
    for (const metric of ['assisted_reps', 'reps', 'duration', 'distance_duration'] satisfies ExerciseMetric[]) expect(calculateSetVolume(set, metric)).toBe(0);
  });
  it('formats metric values and effort without treating assistance as external load', () => {
    expect(formatSetPerformance({ ...set, rir: 2 }, 'assisted_reps')).toBe('40 kg assistance × 10 · RIR 2');
    expect(formatSetPerformance(set, 'duration')).toBe('1:15');
    expect(formatSetPerformance(set, 'distance_duration')).toBe('1.25 km · 1:15');
  });
  it('normalizes measurements and range/effort bounds centrally', () => {
    expect(normalizeWorkoutSet({ ...set, repRangeMin: 12, repRangeMax: 8, rir: 20, durationSeconds: 60.4 }, 'duration')).toMatchObject({ weightKg: 0, reps: 0, durationSeconds: 60, rir: 10, repRangeMax: 12, distanceKm: undefined });
  });
  it('requires actual measurements for each metric, with zero external load allowed for measured reps', () => {
    expect(isValidSetPerformance({ ...set, weightKg: 0 }, 'weight_reps')).toBe(true);
    expect(isValidSetPerformance({ ...set, reps: 0 }, 'weight_reps')).toBe(false);
    expect(isValidSetPerformance({ ...set, durationSeconds: undefined }, 'duration')).toBe(false);
    expect(isValidSetPerformance({ ...set, durationSeconds: 0 }, 'distance_duration')).toBe(false);
    expect(isValidSetPerformance({ ...set, distanceKm: 0 }, 'distance_duration')).toBe(false);
    expect(isValidSetPerformance(set, 'distance_duration')).toBe(true);
  });
});
