import { describe, expect, it } from 'vitest';

import { ActiveWorkout, Exercise, WorkoutExerciseState, WorkoutLog } from '../types';
import {
  adjustRestTimer,
  adjustWorkoutDuration,
  appendWorkoutExercise,
  applyWorkoutShortening,
  createWorkoutLog,
  finishWorkout,
  getWorkoutElapsedSeconds,
  navigateToExercise,
  pauseWorkout,
  removeWorkoutSet,
  removeWorkoutSuperset,
  reorderWorkoutExercise,
  replaceWorkoutExercise,
  restoreWorkoutExercise,
  resumeWorkout,
  skipWorkoutExercise,
  suggestWorkoutShortening,
  uncheckWorkoutSet,
  updateWorkoutSet,
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
    between.entries[0].sets[0].done = true;
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

    workout.entries[0].sets.forEach((set) => { set.done = true; });
    const completed = completeCurrentSet(workout, 90, 5_000);
    expect(completed.phase).toBe('complete');
    expect(completed.completedAt).toBe(5_000);
    expect(getWorkoutElapsedSeconds(completed, 100_000)).toBe(4);
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

const replacement: Exercise = {
  id: 'plank', name: 'Plank', primaryMuscle: 'abs', secondaryMuscles: [], equipment: 'bodyweight',
  category: 'core', movementType: 'isometric', weightMode: 'bodyweight', metric: 'duration', isCustom: false,
};
function identityGenerator() {
  let count = 0;
  return (prefix: string) => `${prefix}-${++count}`;
}

describe('partial saves and flexible sessions', () => {
  it('saves only performed sets with a stopped timer and independent data', () => {
    const workout = completeCurrentSet(createWorkout(), 90, 5_000);
    const ended = finishWorkout(workout, 31_000);
    const log = createWorkoutLog(ended, 120_000, '2026-10-06');
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0].sets.map((set) => set.id)).toEqual(['set-1']);
    expect(log.volumeKg).toBe(500);
    expect(log.durationSeconds).toBe(30);
    expect(log.finishedAt).toBe(31_000);
    expect(log.date).toBe('2026-10-06');
    log.entries[0].sets[0].weightKg = 100;
    expect(workout.entries[0].sets[0].weightKg).toBe(50);
  });

  it('does not claim completion while an earlier exercise has unfinished sets', () => {
    const finishedLast = completeCurrentSet(createWorkout({ exerciseIndex: 1 }), 90, 5_000);
    expect(finishedLast.phase).toBe('between');
    expect(advanceToNextExercise(finishedLast, 90).exerciseIndex).toBe(0);
    expect(finishedLast.entries[0].sets.every((set) => !set.done)).toBe(true);
  });

  it('skips remaining work while preserving performed sets, and allows restoring it', () => {
    const performed = completeCurrentSet(createWorkout(), 90, 5_000);
    const skipped = skipWorkoutExercise(performed, 'workout-exercise-1', 6_000);
    expect(skipped.exerciseIndex).toBe(1);
    expect(skipped.entries[0].skipped).toBe(true);
    expect(createWorkoutLog(skipped, 7_000).entries[0].sets).toHaveLength(1);
    const restored = restoreWorkoutExercise(skipped, 'workout-exercise-1', 8_000);
    expect(restored.entries[0].skipped).toBe(false);
    expect(restored.setIndex).toBe(1);
  });

  it('reorders entries without losing the current exercise or resting target', () => {
    const resting = completeCurrentSet(createWorkout(), 90, 5_000);
    const reordered = reorderWorkoutExercise(resting, 'workout-exercise-1', 1);
    expect(reordered.exerciseIndex).toBe(1);
    expect(reordered.entries[1].id).toBe('workout-exercise-1');
    expect(advanceToNextSet(reordered)).toMatchObject({ exerciseIndex: 1, setIndex: 1 });
  });

  it('replaces only unfinished sets and keeps completed work under the original exercise', () => {
    const performed = completeCurrentSet(createWorkout(), 90, 5_000);
    const updated = replaceWorkoutExercise(performed, 'workout-exercise-1', replacement, 6_000, identityGenerator());
    expect(updated.entries).toHaveLength(3);
    expect(updated.entries[0]).toMatchObject({ exerciseId: 'bench-press' });
    expect(updated.entries[0].sets).toHaveLength(1);
    expect(updated.entries[0].sets[0].done).toBe(true);
    expect(updated.entries[1]).toMatchObject({ exerciseId: 'plank', metric: 'duration' });
    expect(updated.entries[1].sets[0]).toMatchObject({ done: false, durationSeconds: 60, weightKg: 0 });
    expect(updated.exerciseIndex).toBe(1);
  });

  it('adds to an empty workout and carries the metric into the entry', () => {
    const updated = appendWorkoutExercise(createWorkout({ entries: [] }), replacement, 5_000, identityGenerator());
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].metric).toBe('duration');
    expect(updated.phase).toBe('set');
    expect(updated.entries[0].sets[0].durationSeconds).toBe(60);
  });

  it('adds a set during rest while retaining the rest countdown', () => {
    const resting = completeCurrentSet(createWorkout(), 90, 5_000);
    const appended = appendSetToCurrentExercise(resting, { id: 'extra', createdAt: 6_000 });
    expect(appended.entries[0].sets).toHaveLength(3);
    expect(appended.phase).toBe('rest');
    expect(appended.restEndsAt).toBe(resting.restEndsAt);
    expect(advanceToNextSet(appended).setIndex).toBe(1);
  });

  it('removes active and completed sets safely and supports undoing completion', () => {
    const resting = completeCurrentSet(createWorkout(), 90, 5_000);
    const removed = removeWorkoutSet(resting, 'workout-exercise-1', 'set-1', 6_000);
    expect(removed.entries[0].sets.map((set) => set.id)).toEqual(['set-2']);
    expect(removed.setIndex).toBe(0);
    const unchecked = uncheckWorkoutSet(resting, 'workout-exercise-1', 'set-1', 6_000);
    expect(unchecked.phase).toBe('set');
    expect(unchecked.entries[0].sets[0]).toMatchObject({ done: false, completedAt: undefined });
  });

  it('returns to completed exercises to edit the actual performance', () => {
    const completed = completeCurrentSet(createWorkout(), 90, 5_000);
    const returned = navigateToExercise(completed, 'workout-exercise-1', 'set-1');
    const edited = updateWorkoutSet(returned, 'workout-exercise-1', 'set-1', { weightKg: 55, reps: 8 });
    expect(edited.entries[0].sets[0].done).toBe(true);
    expect(createWorkoutLog(edited, 6_000).volumeKg).toBe(440);
  });

  it('repairs the upcoming rest set after its removal', () => {
    const workout = createWorkout();
    workout.entries[0].sets.push({ ...workout.entries[0].sets[1], id: 'set-extra' });
    const resting = completeCurrentSet(workout, 90, 5_000);
    const removed = removeWorkoutSet(resting, 'workout-exercise-1', 'set-2', 6_000);
    expect(removed.phase).toBe('rest');
    expect(removed.restNextSetId).toBe('set-extra');
    expect(advanceToNextSet(removed).setIndex).toBe(1);
  });

  it('keeps ranges and effort when adding sets, but does not copy recorded effort', () => {
    const workout = updateWorkoutSet(createWorkout(), 'workout-exercise-1', 'set-1', { repRangeMin: 8, repRangeMax: 12, targetRir: 2, rir: 1 });
    const appended = appendSetToCurrentExercise(workout, { id: 'extra', createdAt: 6_000 });
    expect(appended.entries[0].sets[2]).toMatchObject({ repRangeMin: 8, repRangeMax: 12, targetRir: 2, rir: undefined });
  });

  it('compares machine history only with the same machine', () => {
    const general = createLog('general', 5_000);
    const machine = createLog('machine', 10_000);
    machine.entries[0].machineMemoryId = 'gym-machine';
    machine.entries[0].sets[0].weightKg = 70;
    expect(findPreviousExercisePerformance([general, machine], 'local-user', 'bench-press')?.[0].weightKg).toBe(50);
    expect(findPreviousExercisePerformance([general, machine], 'local-user', 'bench-press', Infinity, 'gym-machine')?.[0].weightKg).toBe(70);
  });
});

describe('superset scheduling', () => {
  it('runs A1 then B1 then rest then A2 then B2, with no rest inside a round', () => {
    const workout = createWorkout();
    workout.entries[1].sets.push({ ...workout.entries[1].sets[0], id: 'set-4' });
    const paired = toggleSupersetWithNext(workout, 'superset');
    const afterA1 = completeCurrentSet(paired, 90, 5_000);
    expect(afterA1).toMatchObject({ phase: 'set', exerciseIndex: 1, setIndex: 0 });
    expect(afterA1.restEndsAt).toBeUndefined();
    const afterB1 = completeCurrentSet(afterA1, 90, 6_000);
    expect(afterB1.phase).toBe('rest');
    expect(afterB1.restNextExerciseId).toBe('workout-exercise-1');
    const afterRest = advanceToNextSet(afterB1);
    expect(afterRest).toMatchObject({ phase: 'set', exerciseIndex: 0, setIndex: 1 });
    const afterA2 = completeCurrentSet(afterRest, 90, 100_000);
    expect(afterA2).toMatchObject({ phase: 'set', exerciseIndex: 1, setIndex: 1 });
    const afterB2 = completeCurrentSet(afterA2, 90, 101_000);
    expect(afterB2).toMatchObject({ phase: 'complete', completedAt: 101_000 });
  });

  it('handles unequal superset sizes without duplicating already completed sets', () => {
    const paired = toggleSupersetWithNext(createWorkout(), 'superset');
    const a1 = completeCurrentSet(paired, 90, 5_000);
    const b1 = completeCurrentSet(a1, 90, 6_000);
    const a2 = advanceToNextSet(b1);
    expect(a2).toMatchObject({ exerciseIndex: 0, setIndex: 1 });
    const finished = completeCurrentSet(a2, 90, 100_000);
    expect(finished.phase).toBe('complete');
    expect(countCompletedSets(finished.entries)).toBe(3);
  });

  it('removes supersets from either member, including the last entry', () => {
    const paired = toggleSupersetWithNext(createWorkout(), 'superset');
    const unpaired = removeWorkoutSuperset({ ...paired, exerciseIndex: 1 }, 'superset');
    expect(unpaired.entries.every((entry) => entry.supersetGroupId === undefined)).toBe(true);
  });

  it('preserves a superset rest target after exercises are reordered', () => {
    const paired = toggleSupersetWithNext(createWorkout(), 'superset');
    const resting = completeCurrentSet(completeCurrentSet(paired, 90, 5_000), 90, 6_000);
    const reordered = reorderWorkoutExercise(resting, 'workout-exercise-1', 1);
    expect(advanceToNextSet(reordered)).toMatchObject({ exerciseIndex: 1, setIndex: 1 });
  });
});

describe('workout time and shortening', () => {
  it('excludes paused time and stops at completion', () => {
    const paused = pauseWorkout(createWorkout(), 31_000);
    expect(getWorkoutElapsedSeconds(paused, 100_000)).toBe(30);
    expect(completeCurrentSet(paused, 90, 50_000)).toBe(paused);
    const resumed = resumeWorkout(paused, 61_000);
    expect(getWorkoutElapsedSeconds(resumed, 91_000)).toBe(60);
    const ended = finishWorkout(resumed, 91_000);
    expect(getWorkoutElapsedSeconds(ended, 900_000)).toBe(60);
  });

  it('uses pause instant when finishing a paused workout', () => {
    const paused = pauseWorkout(createWorkout(), 31_000);
    const ended = createWorkoutLog(paused, 91_000);
    expect(ended.durationSeconds).toBe(30);
    expect(ended.finishedAt).toBe(31_000);
  });

  it('adjusts elapsed time both while running and after completion', () => {
    const running = adjustWorkoutDuration(createWorkout(), 120, 301_000);
    expect(getWorkoutElapsedSeconds(running, 301_000)).toBe(120);
    const ended = finishWorkout(running, 361_000);
    const adjusted = adjustWorkoutDuration(ended, 90, 900_000);
    expect(createWorkoutLog(adjusted, 900_000).durationSeconds).toBe(90);
    expect(adjusted.completedAt).toBe(361_000);
  });

  it('reopening a completed session does not count time spent reading the summary', () => {
    const ended = finishWorkout(createWorkout(), 31_000);
    const reopened = appendSetToCurrentExercise(ended, { id: 'extra', createdAt: 91_000 });
    expect(reopened.completedAt).toBeUndefined();
    expect(getWorkoutElapsedSeconds(reopened, 101_000)).toBe(40);
  });

  it('resumes from an unfinished exercise after a partial finish without counting summary time', () => {
    const ended = finishWorkout(createWorkout(), 31_000);
    const resumed = navigateToExercise(ended, 'workout-exercise-1', undefined, 91_000);
    expect(resumed.completedAt).toBeUndefined();
    expect(getWorkoutElapsedSeconds(resumed, 101_000)).toBe(40);
  });

  it('suggests a shorter session within budget and preserves completed data', () => {
    const performed = completeCurrentSet(createWorkout(), 90, 5_000);
    const proposal = suggestWorkoutShortening(performed, 1, 95_000);
    expect(proposal.retainedPendingSets).toBe(1);
    expect(proposal.estimatedSeconds).toBeLessThanOrEqual(60);
    expect(proposal.skipEntryIds).toEqual(['workout-exercise-2']);
    const shorter = applyWorkoutShortening(performed, proposal, 95_000);
    expect(shorter.entries[0].sets[0]).toEqual(performed.entries[0].sets[0]);
    expect(shorter.entries[1].skipped).toBe(true);
    expect(shorter.deadlineAt).toBe(155_000);
  });

  it('supports leaving immediately without deleting any completed work', () => {
    const performed = completeCurrentSet(createWorkout(), 90, 5_000);
    const proposal = suggestWorkoutShortening(performed, 0, 6_000);
    const shorter = applyWorkoutShortening(performed, proposal, 6_000);
    expect(shorter.phase).toBe('complete');
    expect(createWorkoutLog(shorter, 100_000).entries[0].sets).toHaveLength(1);
    expect(createWorkoutLog(shorter, 100_000).volumeKg).toBe(500);
  });

  it('estimates the first superset member correctly and retains work that fits', () => {
    const paired = toggleSupersetWithNext(createWorkout(), 'superset');
    const proposal = suggestWorkoutShortening(paired, 0.75, 1_000);
    expect(proposal.retainedPendingSets).toBe(1);
    expect(proposal.estimatedSeconds).toBe(45);
    expect(proposal.removeSetIds).not.toContain('set-1');
  });

  it('timed exercises include their real duration and their recovery', () => {
    const workout = createWorkout();
    workout.entries[0].metric = 'duration';
    workout.entries[0].sets.forEach((set) => { set.durationSeconds = 60; });
    const proposal = suggestWorkoutShortening(workout, 1, 1_000);
    expect(proposal.retainedPendingSets).toBe(1);
    expect(proposal.estimatedSeconds).toBe(60);
  });
});


describe('workout cursor invariants after mutations', () => {
  it('keeps a valid completed set cursor when removing the last pending set', () => {
    const entries = [createEntries()[0]];
    entries[0].sets[0].done = true;
    const workout = createWorkout({ entries, setIndex: 1 });
    const removed = removeWorkoutSet(workout, entries[0].id, 'set-2', 10_000);
    expect(removed.phase).toBe('complete');
    expect(removed.setIndex).toBe(0);
    expect(removed.entries[0].sets[removed.setIndex].id).toBe('set-1');
    expect(createWorkoutLog(removed, 20_000).volumeKg).toBe(500);
  });

  it('follows current set identity when deleting an earlier performed set', () => {
    const entries = createEntries();
    entries[0].sets[0].done = true;
    const workout = createWorkout({ entries, setIndex: 1 });
    const removed = removeWorkoutSet(workout, entries[0].id, 'set-1', 10_000);
    expect(removed.phase).toBe('set');
    expect(removed.setIndex).toBe(0);
    expect(removed.entries[0].sets[removed.setIndex].id).toBe('set-2');
    expect(removed.entries[0].sets[removed.setIndex].done).toBe(false);
  });

  it('finishes after shortening with a valid cursor and without marking pending data done', () => {
    const entries = createEntries();
    entries[0].sets[0].done = true;
    const workout = createWorkout({ entries, setIndex: 1 });
    const shortened = applyWorkoutShortening(workout, suggestWorkoutShortening(workout, 0, 10_000), 10_000);
    expect(shortened.phase).toBe('complete');
    expect(shortened.setIndex).toBe(0);
    expect(shortened.entries[0].sets[shortened.setIndex].id).toBe('set-1');
    expect(countCompletedSets(shortened.entries)).toBe(1);
  });

  it('uses the zero cursor for an empty selected entry and leaves other work pending', () => {
    const entries = createEntries();
    entries[0].sets = [];
    const workout = createWorkout({ entries, exerciseIndex: 1 });
    const selected = navigateToExercise(workout, entries[0].id, undefined, 10_000);
    expect(selected).toMatchObject({ phase: 'set', exerciseIndex: 0, setIndex: 0 });
    const added = appendSetToCurrentExercise(selected, { id: 'new', createdAt: 11_000 });
    expect(added.entries[0].sets[added.setIndex].id).toBe('new');
    expect(added.entries[1].sets[0].done).toBe(false);
  });

  it('finishes an entirely empty workout using its canonical empty cursor', () => {
    const ended = finishWorkout(createWorkout({ entries: [] }), 10_000);
    expect(ended).toMatchObject({ phase: 'complete', exerciseIndex: 0, setIndex: 0 });
    expect(createWorkoutLog(ended, 20_000).entries).toEqual([]);
  });
});


describe('metric-scoped history and valid set completion', () => {
  it('does not reuse incompatible history after changing a custom exercise metric', () => {
    const weighted = createLog('weighted', 5_000);
    const timed = createLog('timed', 10_000);
    timed.entries[0].metric = 'duration';
    timed.entries[0].sets.forEach((set) => { set.durationSeconds = 60; set.reps = 0; set.weightKg = 0; });
    expect(findPreviousExercisePerformance([weighted, timed], 'local-user', 'bench-press', Infinity, undefined, 'weight_reps')?.[0].weightKg).toBe(50);
    expect(findPreviousExercisePerformance([weighted, timed], 'local-user', 'bench-press', Infinity, undefined, 'duration')?.[0].durationSeconds).toBe(60);
    expect(findPreviousExercisePerformance([weighted], 'local-user', 'bench-press', Infinity, undefined, 'duration')).toBeNull();
  });

  it('rejects zero repetitions without advancing or recording a set', () => {
    const workout = createWorkout();
    workout.entries[0].sets[0].reps = 0;
    expect(completeCurrentSet(workout, 90, 5_000)).toBe(workout);
    expect(workout.entries[0].sets[0].done).toBe(false);
  });

  it('requires positive duration and distance for their corresponding metrics', () => {
    const duration = createWorkout();
    duration.entries[0].metric = 'duration';
    expect(completeCurrentSet(duration, 90, 5_000)).toBe(duration);
    duration.entries[0].sets[0].durationSeconds = 0.4;
    expect(completeCurrentSet(duration, 90, 5_000)).toBe(duration);
    duration.entries[0].sets[0].durationSeconds = 30;
    expect(completeCurrentSet(duration, 90, 5_000).entries[0].sets[0].done).toBe(true);
    const distance = createWorkout();
    distance.entries[0].metric = 'distance_duration';
    distance.entries[0].sets[0].durationSeconds = 300;
    expect(completeCurrentSet(distance, 90, 5_000)).toBe(distance);
    distance.entries[0].sets[0].distanceKm = 0.5;
    expect(completeCurrentSet(distance, 90, 5_000).entries[0].sets[0].done).toBe(true);
  });

  it('allows zero additional weight and zero assistance when repetitions are valid', () => {
    const bodyweight = createWorkout();
    bodyweight.entries[0].sets[0].weightKg = 0;
    expect(completeCurrentSet(bodyweight, 90, 5_000).entries[0].sets[0].done).toBe(true);
    const assisted = createWorkout();
    assisted.entries[0].metric = 'assisted_reps';
    assisted.entries[0].sets[0].weightKg = 0;
    expect(completeCurrentSet(assisted, 90, 5_000).entries[0].sets[0].done).toBe(true);
  });
});


describe('new and replaced exercise target units', () => {
  it('normalizes new timed/cardio sets and uses targets in seconds', () => {
    const timed = appendWorkoutExercise(createWorkout({ entries: [] }), replacement, 5_000, identityGenerator());
    expect(timed.entries[0].sets[0]).toMatchObject({ targetReps: 60, durationSeconds: 60, reps: 0, weightKg: 0 });
    const cardio: Exercise = { ...replacement, id: 'cardio', metric: 'distance_duration', category: 'cardio', movementType: 'cardio' };
    const distance = appendWorkoutExercise(createWorkout({ entries: [] }), cardio, 5_000, identityGenerator());
    expect(distance.entries[0].sets[0]).toMatchObject({ targetReps: 600, durationSeconds: 600, distanceKm: 0, reps: 0, weightKg: 0 });
    expect(completeCurrentSet(distance, 90, 6_000)).toBe(distance);
  });

  it('clears incompatible rep targets on replacement and preserves them across rep metrics', () => {
    const workout = updateWorkoutSet(createWorkout(), 'workout-exercise-1', 'set-1', { repRangeMin: 8, repRangeMax: 12, targetRir: 2 });
    const timed = replaceWorkoutExercise(workout, 'workout-exercise-1', replacement, 5_000, identityGenerator());
    expect(timed.entries[0].sets[0]).toMatchObject({ targetReps: 60, durationSeconds: 60, repRangeMin: undefined, repRangeMax: undefined, targetRir: undefined, reps: 0, weightKg: 0 });
    const bodyweight: Exercise = { ...replacement, id: 'bodyweight', metric: 'reps', movementType: 'push' };
    const reps = replaceWorkoutExercise(workout, 'workout-exercise-1', bodyweight, 5_000, identityGenerator());
    expect(reps.entries[0].sets[0]).toMatchObject({ targetReps: 10, repRangeMin: 8, repRangeMax: 12, targetRir: 2, weightKg: 0 });
  });
});
