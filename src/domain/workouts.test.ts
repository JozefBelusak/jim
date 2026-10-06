import { describe, expect, it } from 'vitest';

import { ActiveWorkout, WorkoutExerciseState, WorkoutLog } from '../types';
import {
  adjustRestTimer,
  advanceToNextExercise,
  advanceToNextSet,
  appendSetToCurrentExercise,
  calculateWorkoutVolume,
  completeCurrentSet,
  countCompletedSets,
  countWorkingSets,
  findPreviousExercisePerformance,
  getRestTimerRemaining,
  pauseRestTimer,
  resumeRestTimer,
  toggleSupersetWithNext,
} from './workouts';

function createEntries(): WorkoutExerciseState[] {
  return [
    {
      id: 'workout-exercise-1',
      exerciseId: 'bench-press',
      sets: [
        {
          id: 'set-1',
          workoutExerciseId: 'workout-exercise-1',
          type: 'normal',
          targetReps: 10,
          reps: 10,
          weightKg: 50,
          done: false,
          createdAt: 1_000,
        },
        {
          id: 'set-2',
          workoutExerciseId: 'workout-exercise-1',
          type: 'normal',
          targetReps: 10,
          reps: 8,
          weightKg: 50,
          done: false,
          createdAt: 1_000,
        },
      ],
    },
    {
      id: 'workout-exercise-2',
      exerciseId: 'chest-fly',
      sets: [
        {
          id: 'set-3',
          workoutExerciseId: 'workout-exercise-2',
          type: 'normal',
          targetReps: 12,
          reps: 12,
          weightKg: 20,
          done: false,
          createdAt: 1_000,
        },
      ],
    },
  ];
}

function createWorkout(patch: Partial<ActiveWorkout> = {}): ActiveWorkout {
  return {
    id: 'session-1',
    userId: 'local-user',
    dayId: '2026-08-14',
    name: 'Push',
    startedAt: 1_000,
    exerciseIndex: 0,
    setIndex: 0,
    phase: 'set',
    restTargetSeconds: 90,
    entries: createEntries(),
    ...patch,
  };
}

function createLog(id: string, finishedAt: number, userId = 'local-user'): WorkoutLog {
  const entries = createEntries();
  entries[0].sets.forEach((set) => {
    set.done = true;
  });

  return {
    id,
    userId,
    dayId: '2026-08-14',
    name: 'Push',
    date: '2026-08-14',
    startedAt: finishedAt - 3_600_000,
    finishedAt,
    volumeKg: 900,
    durationSeconds: 3_600,
    entries,
  };
}

describe('workout analytics', () => {
  it('counts only completed working sets in total volume', () => {
    const entries = createEntries();
    entries[0].sets[0].done = true;
    entries[1].sets[0].done = true;

    expect(calculateWorkoutVolume(entries)).toBe(740);
    expect(countCompletedSets(entries)).toBe(2);
    expect(countWorkingSets(entries)).toBe(2);

    entries[0].sets[0].type = 'warmup';
    expect(calculateWorkoutVolume(entries)).toBe(240);
    expect(countCompletedSets(entries)).toBe(2);
    expect(countWorkingSets(entries)).toBe(1);
  });

  it('returns the latest completed performance for the same user and exercise', () => {
    const older = createLog('older', 5_000);
    older.entries[0].sets[0].weightKg = 40;
    const latest = createLog('latest', 10_000);
    latest.entries[0].sets[0].weightKg = 55;
    const anotherUser = createLog('other-user', 20_000, 'another-user');

    const result = findPreviousExercisePerformance(
      [older, anotherUser, latest],
      'local-user',
      'bench-press',
      30_000,
    );

    expect(result?.[0].weightKg).toBe(55);
    expect(findPreviousExercisePerformance([latest], 'local-user', 'squat')).toBeNull();
  });
});

describe('active workout transitions', () => {
  it('completes a set and starts rest once', () => {
    const completed = completeCurrentSet(createWorkout(), 120, 5_000);
    const duplicateTap = completeCurrentSet(completed, 120, 6_000);

    expect(completed.entries[0].sets[0]).toMatchObject({ done: true, completedAt: 5_000 });
    expect(completed.phase).toBe('rest');
    expect(completed.restTargetSeconds).toBe(120);
    expect(completed.restStartedAt).toBe(5_000);
    expect(completed.restEndsAt).toBe(125_000);
    expect(duplicateTap).toBe(completed);
  });

  it('pauses, adjusts and resumes the rest timer', () => {
    const resting = completeCurrentSet(createWorkout(), 90, 5_000);
    const paused = pauseRestTimer(resting, 35_000);
    const adjusted = adjustRestTimer(paused, 30, 40_000);
    const resumed = resumeRestTimer(adjusted, 50_000);

    expect(paused.restPausedRemainingSeconds).toBe(60);
    expect(getRestTimerRemaining(paused, 45_000)).toBe(60);
    expect(adjusted.restPausedRemainingSeconds).toBe(90);
    expect(resumed.restPausedRemainingSeconds).toBeUndefined();
    expect(resumed.restEndsAt).toBe(140_000);
    expect(getRestTimerRemaining(resumed, 80_000)).toBe(60);
  });

  it('does not skip a set when next is tapped twice', () => {
    const resting = completeCurrentSet(createWorkout(), 90, 5_000);
    const next = advanceToNextSet(resting);
    const duplicateTap = advanceToNextSet(next);

    expect(next.phase).toBe('set');
    expect(next.setIndex).toBe(1);
    expect(duplicateTap).toBe(next);
  });

  it('moves between exercises only from the between phase', () => {
    const between = createWorkout({ setIndex: 1, phase: 'set' });
    const completed = completeCurrentSet(between, 90, 5_000);
    const next = advanceToNextExercise(completed, 180);
    const duplicateTap = advanceToNextExercise(next, 180);

    expect(completed.phase).toBe('between');
    expect(next.exerciseIndex).toBe(1);
    expect(next.setIndex).toBe(0);
    expect(next.restTargetSeconds).toBe(180);
    expect(duplicateTap).toBe(next);
  });

  it('finishes after the final set of the final exercise', () => {
    const workout = createWorkout({ exerciseIndex: 1, setIndex: 0 });

    expect(completeCurrentSet(workout, 90, 5_000).phase).toBe('complete');
  });

  it('appends an extra set with stable session identity', () => {
    const workout = createWorkout();
    const updated = appendSetToCurrentExercise(workout, {
      id: 'generated-set-id',
      createdAt: 2_000,
    });

    expect(updated.setIndex).toBe(0);
    expect(updated.entries[0].sets).toHaveLength(3);
    expect(updated.entries[0].sets[2]).toMatchObject({
      id: 'generated-set-id',
      workoutExerciseId: 'workout-exercise-1',
      type: 'normal',
      reps: 10,
      weightKg: 50,
      done: false,
      createdAt: 2_000,
    });
  });

  it('pairs the current and next exercise as a removable superset', () => {
    const paired = toggleSupersetWithNext(createWorkout(), 'superset-1');
    const unpaired = toggleSupersetWithNext(paired, 'unused-group');

    expect(paired.entries[0].supersetGroupId).toBe('superset-1');
    expect(paired.entries[1].supersetGroupId).toBe('superset-1');
    expect(unpaired.entries.every((entry) => entry.supersetGroupId === undefined)).toBe(true);
  });
});
