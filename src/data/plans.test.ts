import { describe, expect, it } from 'vitest';

import { WorkoutLog, WorkoutSet } from '../types';
import { buildWeekDays, createSets, getTodayIso, todayIso } from './plans';

describe('workout set creation', () => {
  it('prefills reps, weight and type from the previous performance by set position', () => {
    const previousSets: WorkoutSet[] = [
      {
        id: 'old-set-1',
        workoutExerciseId: 'old-entry',
        type: 'warmup',
        targetReps: 12,
        reps: 12,
        weightKg: 20,
        done: true,
        createdAt: 1,
        completedAt: 2,
      },
      {
        id: 'old-set-2',
        workoutExerciseId: 'old-entry',
        type: 'normal',
        targetReps: 8,
        reps: 9,
        weightKg: 60,
        done: true,
        createdAt: 1,
        completedAt: 3,
      },
    ];

    const sets = createSets(
      { exerciseId: 'bench-press', sets: 3, reps: 10, weightKg: 50, restSeconds: 90 },
      {
        workoutExerciseId: 'new-entry',
        setIds: ['new-set-1', 'new-set-2', 'new-set-3'],
        createdAt: 10,
        previousSets,
      },
    );

    expect(sets).toMatchObject([
      { id: 'new-set-1', workoutExerciseId: 'new-entry', type: 'warmup', reps: 12, weightKg: 20 },
      { id: 'new-set-2', workoutExerciseId: 'new-entry', type: 'normal', reps: 9, weightKg: 60 },
      { id: 'new-set-3', workoutExerciseId: 'new-entry', type: 'normal', reps: 10, weightKg: 50 },
    ]);
    expect(sets.every((set) => !set.done && set.createdAt === 10)).toBe(true);
  });
});

describe('calendar workout log', () => {
  it('counts multiple completed sessions on the same day', () => {
    const createLog = (id: string): WorkoutLog => ({
      id,
      userId: 'local-user',
      dayId: todayIso,
      name: 'Workout',
      date: todayIso,
      startedAt: 1,
      finishedAt: 2,
      volumeKg: 0,
      durationSeconds: 1,
      entries: [],
    });

    const today = buildWeekDays([createLog('one'), createLog('two')], 0)
      .find((day) => day.iso === todayIso);

    expect(today).toMatchObject({ done: true, workoutCount: 2 });
  });
});

describe('date rollover and target preservation', () => {
  it('calculates today each time and respects the supplied calendar anchor', () => {
    expect(getTodayIso(new Date(2026, 9, 6, 23, 59))).toBe('2026-10-06');
    expect(getTodayIso(new Date(2026, 9, 7, 0, 1))).toBe('2026-10-07');
    expect(buildWeekDays([], 0, '2026-10-12')[0].iso).toBe('2026-10-12');
  });

  it('preserves rep ranges and effort targets when creating a workout', () => {
    const [set] = createSets(
      { exerciseId: 'bench-press', sets: 1, reps: 12, weightKg: 20, restSeconds: 90, repRangeMin: 8, repRangeMax: 12, targetRir: 2, notes: 'Controlled tempo' },
      { workoutExerciseId: 'entry', setIds: ['set'], createdAt: 100 },
    );
    expect(set).toMatchObject({ repRangeMin: 8, repRangeMax: 12, targetRir: 2, note: 'Controlled tempo' });
  });
});
