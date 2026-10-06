import { describe, expect, it } from 'vitest';

import { WorkoutLog, WorkoutSet } from '../types';
import { buildWeekDays, createSets, todayIso } from './plans';

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
