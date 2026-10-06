import { ActiveWorkout, WorkoutExerciseState, WorkoutLog, WorkoutSet } from '../types';

export function calculateWorkoutVolume(entries: WorkoutExerciseState[]) {
  return entries.reduce(
    (workoutTotal, entry) =>
      workoutTotal +
      entry.sets.reduce(
        (exerciseTotal, set) =>
          exerciseTotal + (set.done && set.type !== 'warmup' ? set.reps * set.weightKg : 0),
        0,
      ),
    0,
  );
}

export function countCompletedSets(entries: WorkoutExerciseState[]) {
  return entries.reduce(
    (total, entry) => total + entry.sets.filter((set) => set.done).length,
    0,
  );
}

export function countWorkingSets(entries: WorkoutExerciseState[]) {
  return entries.reduce(
    (total, entry) =>
      total + entry.sets.filter((set) => set.done && set.type !== 'warmup').length,
    0,
  );
}

export function findPreviousExercisePerformance(
  logs: WorkoutLog[],
  userId: string,
  exerciseId: string,
  beforeStartedAt = Number.POSITIVE_INFINITY,
): WorkoutSet[] | null {
  const previousLog = [...logs]
    .filter((log) => log.userId === userId && log.startedAt < beforeStartedAt)
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .find((log) =>
      log.entries.some(
        (entry) => entry.exerciseId === exerciseId && entry.sets.some((set) => set.done),
      ),
    );
  const entry = previousLog?.entries.find((item) => item.exerciseId === exerciseId);

  return entry ? entry.sets.filter((set) => set.done) : null;
}

export function completeCurrentSet(
  workout: ActiveWorkout,
  restSeconds: number,
  completedAt: number,
): ActiveWorkout {
  if (workout.phase !== 'set') {
    return workout;
  }

  const activeEntry = workout.entries[workout.exerciseIndex];
  const activeSet = activeEntry?.sets[workout.setIndex];

  if (!activeEntry || !activeSet) {
    return workout;
  }

  const entries = workout.entries.map((entry, entryIndex) =>
    entryIndex === workout.exerciseIndex
      ? {
          ...entry,
          sets: entry.sets.map((set, setIndex) =>
            setIndex === workout.setIndex
              ? { ...set, done: true, completedAt }
              : set,
          ),
        }
      : entry,
  );
  const isLastSet = workout.setIndex === activeEntry.sets.length - 1;
  const isLastExercise = workout.exerciseIndex === entries.length - 1;

  if (isLastSet && isLastExercise) {
    return { ...workout, entries, phase: 'complete' };
  }

  if (isLastSet) {
    return { ...workout, entries, phase: 'between' };
  }

  return {
    ...workout,
    entries,
    phase: 'rest',
    restTargetSeconds: restSeconds,
    restStartedAt: completedAt,
    restEndsAt: completedAt + restSeconds * 1000,
    restPausedRemainingSeconds: undefined,
  };
}

export function advanceToNextSet(workout: ActiveWorkout): ActiveWorkout {
  const activeEntry = workout.entries[workout.exerciseIndex];

  if (
    workout.phase !== 'rest' ||
    !activeEntry ||
    workout.setIndex >= activeEntry.sets.length - 1
  ) {
    return workout;
  }

  return {
    ...workout,
    setIndex: workout.setIndex + 1,
    phase: 'set',
    restStartedAt: undefined,
    restEndsAt: undefined,
    restPausedRemainingSeconds: undefined,
  };
}

export function advanceToNextExercise(
  workout: ActiveWorkout,
  restSeconds: number,
): ActiveWorkout {
  const nextExerciseIndex = workout.exerciseIndex + 1;

  if (
    workout.phase !== 'between' ||
    nextExerciseIndex >= workout.entries.length
  ) {
    return workout;
  }

  return {
    ...workout,
    exerciseIndex: nextExerciseIndex,
    setIndex: 0,
    phase: 'set',
    restStartedAt: undefined,
    restEndsAt: undefined,
    restPausedRemainingSeconds: undefined,
    restTargetSeconds: restSeconds,
  };
}

export function appendSetToCurrentExercise(
  workout: ActiveWorkout,
  identity: { id: string; createdAt: number },
): ActiveWorkout {
  if (workout.phase !== 'set') {
    return workout;
  }

  const activeEntry = workout.entries[workout.exerciseIndex];
  const sourceSet =
    activeEntry?.sets[workout.setIndex] ??
    activeEntry?.sets[activeEntry.sets.length - 1];

  if (!activeEntry) {
    return workout;
  }

  const nextSet = {
    id: identity.id,
    workoutExerciseId: activeEntry.id,
    type: sourceSet?.type ?? 'normal',
    targetReps: sourceSet?.targetReps ?? 10,
    reps: sourceSet?.reps ?? 10,
    weightKg: sourceSet?.weightKg ?? 0,
    done: false,
    note: '',
    createdAt: identity.createdAt,
  };

  return {
    ...workout,
    entries: workout.entries.map((entry, entryIndex) =>
      entryIndex === workout.exerciseIndex
        ? { ...entry, sets: [...entry.sets, nextSet] }
        : entry,
    ),
  };
}

export function toggleSupersetWithNext(
  workout: ActiveWorkout,
  groupId: string,
): ActiveWorkout {
  const currentEntry = workout.entries[workout.exerciseIndex];
  const nextEntry = workout.entries[workout.exerciseIndex + 1];

  if (!currentEntry || !nextEntry) {
    return workout;
  }

  const existingGroupId = currentEntry.supersetGroupId;
  const isPairedWithNext =
    existingGroupId !== undefined && nextEntry.supersetGroupId === existingGroupId;

  return {
    ...workout,
    entries: workout.entries.map((entry, entryIndex) => {
      if (isPairedWithNext) {
        return entry.supersetGroupId === existingGroupId
          ? { ...entry, supersetGroupId: undefined }
          : entry;
      }

      if (entryIndex === workout.exerciseIndex || entryIndex === workout.exerciseIndex + 1) {
        return { ...entry, supersetGroupId: groupId };
      }

      return entry.supersetGroupId === existingGroupId && existingGroupId !== undefined
        ? { ...entry, supersetGroupId: undefined }
        : entry;
    }),
  };
}

export function getRestTimerRemaining(workout: ActiveWorkout, now: number) {
  if (workout.restPausedRemainingSeconds !== undefined) {
    return workout.restPausedRemainingSeconds;
  }

  if (workout.restEndsAt !== undefined) {
    return Math.ceil((workout.restEndsAt - now) / 1000);
  }

  const elapsed = Math.floor((now - (workout.restStartedAt ?? now)) / 1000);
  return workout.restTargetSeconds - elapsed;
}

export function pauseRestTimer(workout: ActiveWorkout, now: number): ActiveWorkout {
  if (workout.phase !== 'rest' || workout.restPausedRemainingSeconds !== undefined) {
    return workout;
  }

  return {
    ...workout,
    restPausedRemainingSeconds: Math.max(0, getRestTimerRemaining(workout, now)),
    restEndsAt: undefined,
  };
}

export function resumeRestTimer(workout: ActiveWorkout, now: number): ActiveWorkout {
  if (workout.phase !== 'rest' || workout.restPausedRemainingSeconds === undefined) {
    return workout;
  }

  return {
    ...workout,
    restEndsAt: now + workout.restPausedRemainingSeconds * 1000,
    restPausedRemainingSeconds: undefined,
  };
}

export function adjustRestTimer(
  workout: ActiveWorkout,
  adjustmentSeconds: number,
  now: number,
): ActiveWorkout {
  if (workout.phase !== 'rest') {
    return workout;
  }

  if (workout.restPausedRemainingSeconds !== undefined) {
    return {
      ...workout,
      restPausedRemainingSeconds: Math.max(
        0,
        workout.restPausedRemainingSeconds + adjustmentSeconds,
      ),
    };
  }

  const currentEndsAt =
    workout.restEndsAt ?? now + getRestTimerRemaining(workout, now) * 1000;
  return {
    ...workout,
    restEndsAt: Math.max(now, currentEndsAt + adjustmentSeconds * 1000),
  };
}
