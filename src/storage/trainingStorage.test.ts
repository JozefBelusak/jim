import { describe, expect, it } from 'vitest';

import { ActiveWorkout, PlanDay, WorkoutLog } from '../types';
import {
  currentTrainingStorageVersion,
  parseLegacyTrainingStorage,
  parsePreviousTrainingStorageEnvelope,
  parseTrainingStorageEnvelope,
  serializeTrainingState,
  TrainingState,
} from './trainingStorage';

const plan: PlanDay = {
  id: '2026-08-14',
  date: '2026-08-14',
  label: 'Push',
  focus: 'Chest',
  exercises: [
    { exerciseId: 'bench-press', sets: 3, reps: 10, weightKg: 60, restSeconds: 120 },
  ],
};

const activeWorkout: ActiveWorkout = {
  id: 'session-1',
  userId: 'local-user',
  dayId: plan.id,
  name: 'Push',
  startedAt: 1_000,
  exerciseIndex: 0,
  setIndex: 0,
  phase: 'set',
  restTargetSeconds: 120,
  entries: [
    {
      id: 'workout-exercise-1',
      exerciseId: 'bench-press',
      restSeconds: 120,
      sets: [
        {
          id: 'set-1',
          workoutExerciseId: 'workout-exercise-1',
          type: 'normal',
          targetReps: 10,
          reps: 10,
          weightKg: 60,
          done: false,
          createdAt: 1_000,
        },
      ],
    },
  ],
};

const log: WorkoutLog = {
  id: 'log-1',
  userId: 'local-user',
  dayId: plan.id,
  name: 'Push',
  date: plan.date,
  startedAt: 1_000,
  finishedAt: 3_601_000,
  volumeKg: 600,
  durationSeconds: 3_600,
  entries: [
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
          weightKg: 60,
          done: true,
          createdAt: 1_000,
          completedAt: 2_000,
        },
      ],
    },
  ],
};

const state: TrainingState = {
  schedule: { [plan.date]: plan },
  logs: [log],
  activeWorkout,
  customExercises: [
    {
      id: 'custom-press',
      name: 'Custom press',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'cable',
      category: 'compound',
      movementType: 'push',
      weightMode: 'external',
      isCustom: true,
      createdBy: 'local-user',
    },
  ],
  templates: [
    {
      id: 'template-1',
      userId: 'local-user',
      name: 'Push',
      exercises: [
        {
          id: 'template-exercise-1',
          exerciseId: 'bench-press',
          order: 0,
          targetSets: 3,
          repRangeMin: 8,
          repRangeMax: 12,
          restSeconds: 120,
        },
      ],
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

describe('training storage schema', () => {
  it('round-trips the current versioned format', () => {
    const raw = serializeTrainingState(state, 5_000);

    expect(JSON.parse(raw)).toMatchObject({
      version: currentTrainingStorageVersion,
      savedAt: 5_000,
    });
    expect(parseTrainingStorageEnvelope(raw)).toEqual(state);
  });

  it('loads the existing unversioned v1 format', () => {
    expect(parseLegacyTrainingStorage(JSON.stringify(state))).toEqual(state);
  });

  it('migrates the previous v2 envelope with an empty custom catalog', () => {
    const previousState = {
      schedule: state.schedule,
      logs: state.logs,
      activeWorkout: state.activeWorkout,
    };
    const raw = JSON.stringify({ version: 2, savedAt: 5_000, data: previousState });

    expect(parsePreviousTrainingStorageEnvelope(raw)).toEqual({
      ...previousState,
      customExercises: [],
      templates: [],
    });
  });

  it('migrates the previous v3 envelope while preserving custom exercises', () => {
    const previousState = {
      schedule: state.schedule,
      logs: state.logs,
      activeWorkout: state.activeWorkout,
      customExercises: state.customExercises,
    };
    const raw = JSON.stringify({ version: 3, savedAt: 5_000, data: previousState });

    expect(parsePreviousTrainingStorageEnvelope(raw)).toEqual({
      ...previousState,
      templates: [],
    });
  });

  it('migrates v4 workout sessions to stable identities and timing fields', () => {
    const oldActiveWorkout = {
      dayId: plan.id,
      startedAt: 1_000,
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'rest',
      restTargetSeconds: 120,
      restStartedAt: 2_000,
      entries: [
        {
          exerciseId: 'bench-press',
          sets: [
            { id: 'set-1', targetReps: 10, reps: 10, weightKg: 60, done: true },
          ],
        },
      ],
    };
    const oldLog = {
      id: 'old-log',
      dayId: plan.id,
      date: plan.date,
      volumeKg: 600,
      durationSeconds: 3_600,
      entries: oldActiveWorkout.entries,
    };
    const raw = JSON.stringify({
      version: 4,
      savedAt: 5_000,
      data: {
        schedule: state.schedule,
        logs: [oldLog],
        activeWorkout: oldActiveWorkout,
        customExercises: state.customExercises,
        templates: state.templates,
      },
    });

    const migrated = parsePreviousTrainingStorageEnvelope(raw);

    expect(migrated?.activeWorkout).toMatchObject({
      id: 'legacy-session-1000',
      userId: 'local-user',
      name: 'Workout',
      restEndsAt: 122_000,
      entries: [
        {
          id: 'legacy-workout-exercise-0-bench-press',
          sets: [
            {
              workoutExerciseId: 'legacy-workout-exercise-0-bench-press',
              type: 'normal',
              createdAt: 1_000,
            },
          ],
        },
      ],
    });
    expect(migrated?.logs[0]).toMatchObject({
      id: 'old-log',
      userId: 'local-user',
      name: 'Workout',
      startedAt: Date.parse(plan.date),
      finishedAt: Date.parse(plan.date) + 3_600_000,
    });
  });

  it('rejects invalid JSON and unknown storage versions', () => {
    expect(parseTrainingStorageEnvelope('{invalid')).toBeNull();
    expect(
      parseTrainingStorageEnvelope(JSON.stringify({ version: 99, savedAt: 1, data: state })),
    ).toBeNull();
  });

  it('keeps valid records while dropping malformed nested records', () => {
    const parsed = parseLegacyTrainingStorage(
      JSON.stringify({
        schedule: { valid: plan, invalid: { label: 'Broken' } },
        logs: [log, { id: 'broken' }],
        activeWorkout: { ...activeWorkout, setIndex: 99 },
      }),
    );

    expect(parsed).toEqual({
      schedule: { valid: plan },
      logs: [log],
      activeWorkout: null,
      customExercises: [],
      templates: [],
    });
  });
});
