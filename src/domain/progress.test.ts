import { describe, expect, it } from 'vitest';

import { WorkoutExerciseState, WorkoutLog, WorkoutSet } from '../types';
import {
  buildExerciseProgress,
  calculateEstimated1Rm,
  calculatePersonalRecords,
  applyProgressionRecommendation,
  getProgressionRecommendation,
  getWeeklySummary,
} from './progress';
import { exerciseDb } from '../data/exercises';

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

describe('metric-aware records and recommendations', () => {
  it('rewards reduced assistance with maintained reps, never higher assistance or lower reps', () => {
    const previous = createLog('previous', 1000, [createSet('old', 40, 10)]);
    previous.entries[0].metric = 'assisted_reps';
    const current = { ...createEntry([createSet('new', 30, 10)]), metric: 'assisted_reps' as const };
    expect(calculatePersonalRecords([current], [previous], 'local-user').map((record) => record.type)).toEqual(['least_assistance']);
    expect(calculatePersonalRecords([{ ...current, sets: [createSet('new', 50, 10)] }], [previous], 'local-user')).toEqual([]);
    expect(calculatePersonalRecords([{ ...current, sets: [createSet('new', 30, 5)] }], [previous], 'local-user')).toEqual([]);
    expect(calculatePersonalRecords([{ ...current, sets: [createSet('new', 30, 12)] }], [previous], 'local-user').some((record) => record.type === 'least_assistance')).toBe(true);
  });
  it('recognizes repetitions, duration and distance without generating weight/volume records', () => {
    const reps = { ...createEntry([createSet('reps', 100, 15)]), metric: 'reps' as const };
    const duration = { ...createEntry([{ ...createSet('hold', 100, 15), durationSeconds: 60 }]), metric: 'duration' as const };
    const cardio = { ...createEntry([{ ...createSet('cardio', 100, 15), durationSeconds: 600, distanceKm: 2 }]), metric: 'distance_duration' as const };
    expect(calculatePersonalRecords([reps], [], 'local-user').map((record) => record.type)).toEqual(['most_reps']);
    expect(calculatePersonalRecords([duration], [], 'local-user').map((record) => record.type)).toEqual(['longest_duration']);
    expect(calculatePersonalRecords([cardio], [], 'local-user').map((record) => record.type)).toEqual(['longest_distance']);
  });
  it('keeps PRs separate between individual machines', () => {
    const old = createLog('old', 1000, [createSet('old', 100, 10)]);
    old.entries[0].machineMemoryId = 'gym-a';
    const current = { ...createEntry([createSet('new', 50, 10)]), machineMemoryId: 'gym-b' };
    expect(calculatePersonalRecords([current], [old], 'local-user').some((record) => record.type === 'highest_weight')).toBe(true);
    expect(calculatePersonalRecords([createEntry([createSet('unassigned', 50, 10)])], [old], 'local-user').some((record) => record.type === 'highest_weight')).toBe(true);
  });
  it('separates machine scopes and changed metrics in progress series', () => {
    const general = createLog('general', 1000, [createSet('general', 50, 10)]);
    const machine = createLog('machine', 2000, [createSet('machine', 100, 10)]);
    machine.entries[0].machineMemoryId = 'machine';
    const duration = createLog('duration', 3000, [{ ...createSet('duration', 0, 0), durationSeconds: 60 }]);
    duration.entries[0].metric = 'duration';
    expect(buildExerciseProgress([general, machine, duration], 'local-user', 'bench-press', 'all', 4000, undefined, 'weight_reps').points.map((point) => point.logId)).toEqual(['general']);
    expect(buildExerciseProgress([general, machine, duration], 'local-user', 'bench-press', 'all', 4000, 'machine', 'weight_reps').points.map((point) => point.logId)).toEqual(['machine']);
  });
  it('creates assisted progress without e1RM or volume', () => {
    const log = createLog('log', 1000, [createSet('set', 40, 10)]);
    log.entries[0].metric = 'assisted_reps';
    const progress = buildExerciseProgress([log], 'local-user', 'bench-press', 'all', 2000);
    expect(progress).toMatchObject({ bestWeightKg: 0, bestEstimated1RmKg: 0, bestSessionVolumeKg: 0, minAssistanceKg: 40 });
  });
  it('uses the full rep range and effort to suggest progression, and applies only to planned sets', () => {
    const previous = createLog('previous', 1000, [{ ...createSet('old', 50, 12), rir: 2 }, { ...createSet('old-2', 50, 12), rir: 2 }]);
    const target = createEntry([{ ...createSet('target', 50, 8), done: false, repRangeMin: 8, repRangeMax: 12, targetRir: 2 }, createSet('already-done', 40, 8)]);
    const recommendation = getProgressionRecommendation(target, [previous], 'local-user');
    expect(recommendation).toMatchObject({ action: 'increase', suggestedWeightKg: 52.5, suggestedReps: 8 });
    const applied = applyProgressionRecommendation(target, recommendation!);
    expect(applied.sets[0]).toMatchObject({ weightKg: 52.5, reps: 8, repRangeMin: 8, repRangeMax: 12 });
    expect(applied.sets[1].weightKg).toBe(40);
    previous.entries[0].sets[0].rir = 0;
    expect(getProgressionRecommendation(target, [previous], 'local-user')?.action).toBe('reduce');
  });
  it('reduces assistance for progression and keeps recommendations scoped to machine and user', () => {
    const previous = createLog('previous', 1000, [createSet('old', 40, 12)]);
    previous.entries[0].metric = 'assisted_reps';
    previous.entries[0].machineMemoryId = 'gym';
    const target = { ...createEntry([{ ...createSet('next', 40, 8), repRangeMin: 8, repRangeMax: 12 }]), metric: 'assisted_reps' as const, machineMemoryId: 'gym' };
    expect(getProgressionRecommendation(target, [previous], 'local-user')).toMatchObject({ action: 'increase', suggestedWeightKg: 37.5 });
    expect(getProgressionRecommendation({ ...target, machineMemoryId: 'different' }, [previous], 'local-user')).toBeNull();
    expect(getProgressionRecommendation(target, [previous], 'another-user')).toBeNull();
  });
  it('holds progression after partial history even when every retained set hit the upper rep target', () => {
    const previous = createLog('partial', 1000, [{ ...createSet('only-completed', 50, 12), rir: 3 }]);
    const target = createEntry(Array.from({ length: 3 }, (_, index) => ({ ...createSet(`target-${index}`, 50, 8), done: false, repRangeMin: 8, repRangeMax: 12 })));
    expect(getProgressionRecommendation(target, [previous], 'local-user')).toMatchObject({ action: 'hold', suggestedWeightKg: 50 });
    expect(getProgressionRecommendation(target, [previous], 'local-user')?.message).toContain('1 of the 3');
    const assisted = { ...target, metric: 'assisted_reps' as const };
    previous.entries[0].metric = 'assisted_reps';
    expect(getProgressionRecommendation(assisted, [previous], 'local-user')?.action).toBe('hold');
    const duration = { ...target, metric: 'duration' as const };
    previous.entries[0].metric = 'duration';
    previous.entries[0].sets[0].durationSeconds = 60;
    expect(getProgressionRecommendation(duration, [previous], 'local-user')).toMatchObject({ action: 'hold', suggestedDurationSeconds: 60 });
  });
  it('ignores incomplete measurements and zero-rep sets for PRs and graphs', () => {
    const emptyWeighted = createEntry([createSet('invalid-weight', 500, 0)]);
    expect(calculatePersonalRecords([emptyWeighted], [], 'local-user')).toEqual([]);
    for (const entry of [
      { ...emptyWeighted, metric: 'reps' as const },
      { ...emptyWeighted, metric: 'assisted_reps' as const },
      { ...emptyWeighted, metric: 'duration' as const },
      { ...emptyWeighted, metric: 'distance_duration' as const, sets: [{ ...emptyWeighted.sets[0], distanceKm: 10, durationSeconds: 0 }] },
    ]) {
      expect(calculatePersonalRecords([entry], [], 'local-user')).toEqual([]);
      const log = { ...createLog('invalid', 1000, []), entries: [entry] };
      expect(buildExerciseProgress([log], 'local-user', 'bench-press', 'all', 2000).points).toEqual([]);
      expect(getProgressionRecommendation(entry, [log], 'local-user')).toBeNull();
    }
    const log = createLog('invalid', 1000, emptyWeighted.sets);
    const valid = createEntry([createSet('valid', 50, 10)]);
    expect(calculatePersonalRecords([valid], [log], 'local-user').find((record) => record.type === 'highest_weight')).toMatchObject({ value: 50, previousValue: 0 });
  });
  it('summarizes the current calendar week including partial workouts and primary muscle sets', () => {
    const current = createLog('current', 1000, [createSet('working', 50, 10), createSet('warmup', 20, 10, 'warmup')]);
    current.date = '2026-10-06';
    const previous = createLog('previous', 1, [createSet('old', 50, 10)]);
    previous.date = '2026-09-30';
    const summary = getWeeklySummary([current, previous], exerciseDb, 'local-user', '2026-10-06');
    expect(summary).toMatchObject({ weekStart: '2026-10-05', weekEnd: '2026-10-11', workoutCount: 1, previousWorkoutCount: 1, completedSets: 1, volumeKg: 500, muscleSets: [{ muscle: 'chest', sets: 1 }] });
  });
});
