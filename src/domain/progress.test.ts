import { describe, expect, it } from 'vitest';

import { WorkoutExerciseState, WorkoutLog, WorkoutSet } from '../types';
import {
  buildExerciseProgress,
  calculateEstimated1Rm,
  calculatePersonalRecords,
} from './progress';

function createSet(
  id: string,
  weightKg: number,
  reps: number,
  type: WorkoutSet['type'] = 'normal',
): WorkoutSet {
  return {
    id,
    workoutExerciseId: 'entry-1',
    type,
    targetReps: reps,
    reps,
    weightKg,
    done: true,
    createdAt: 1,
    completedAt: 2,
  };
}

function createEntry(sets: WorkoutSet[]): WorkoutExerciseState {
  return { id: 'entry-1', exerciseId: 'bench-press', sets };
}

function createLog(
  id: string,
  startedAt: number,
  sets: WorkoutSet[],
  userId = 'local-user',
): WorkoutLog {
  return {
    id,
    userId,
    dayId: 'day',
    name: 'Push',
    date: '2026-08-14',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    durationSeconds: 3_600,
    volumeKg: 0,
    entries: [createEntry(sets)],
  };
}

describe('progress analytics', () => {
  it('uses the Epley formula for estimated 1RM', () => {
    expect(calculateEstimated1Rm(100, 6)).toBe(120);
    expect(calculateEstimated1Rm(0, 10)).toBe(0);
  });

  it('detects each supported personal record against previous completed sets', () => {
    const previous = createLog('previous', 1_000, [
      createSet('old-1', 50, 10),
      createSet('old-2', 55, 6),
    ]);
    const current = createEntry([
      createSet('warmup', 100, 20, 'warmup'),
      createSet('new-1', 60, 6),
      createSet('new-2', 50, 12),
    ]);

    const records = calculatePersonalRecords([current], [previous], 'local-user');

    expect(records.map((record) => record.type)).toEqual([
      'highest_weight',
      'reps_at_weight',
      'estimated_1rm',
      'set_volume',
      'exercise_session_volume',
    ]);
    expect(records.find((record) => record.type === 'highest_weight')?.weightKg).toBe(60);
    expect(records.find((record) => record.type === 'reps_at_weight')).toMatchObject({
      weightKg: 50,
      reps: 12,
      previousValue: 10,
    });
  });

  it('does not report records for a lower performance or another user history', () => {
    const best = createLog('best', 1_000, [createSet('best-set', 100, 10)]);
    const current = createEntry([createSet('current-set', 100, 8)]);

    expect(calculatePersonalRecords([current], [best], 'local-user')).toEqual([]);
    expect(calculatePersonalRecords([current], [best], 'another-user')).not.toEqual([]);
  });

  it('builds timeframe-filtered chronological exercise trends', () => {
    const now = Date.UTC(2026, 7, 14);
    const oldLog = createLog('old', now - 100 * 86_400_000, [createSet('old-set', 40, 10)]);
    const recentLog = createLog('recent', now - 10 * 86_400_000, [
      createSet('recent-set-1', 50, 10),
      createSet('recent-set-2', 55, 5),
    ]);

    const month = buildExerciseProgress([recentLog, oldLog], 'local-user', 'bench-press', '1m', now);
    const all = buildExerciseProgress([recentLog, oldLog], 'local-user', 'bench-press', 'all', now);

    expect(month.points.map((point) => point.logId)).toEqual(['recent']);
    expect(month).toMatchObject({ bestWeightKg: 55, bestSessionVolumeKg: 775 });
    expect(month.bestEstimated1RmKg).toBeCloseTo(66.67, 2);
    expect(all.points.map((point) => point.logId)).toEqual(['old', 'recent']);
    expect(all.lastPerformance?.logId).toBe('recent');
  });
});
