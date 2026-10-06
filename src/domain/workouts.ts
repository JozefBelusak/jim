import { ActiveWorkout, Exercise, ExerciseMetric, WorkoutExerciseState, WorkoutLog, WorkoutSet } from '../types';
import { calculateSetVolume, getEntryMetric, getExerciseMetric, isValidSetPerformance, normalizeWorkoutSet } from './metrics';

export function calculateWorkoutVolume(entries: WorkoutExerciseState[]) {
  return entries.reduce((total, entry) => total + entry.sets.reduce(
    (sum, set) => sum + (set.done && set.type !== 'warmup' ? calculateSetVolume(set, getEntryMetric(entry)) : 0), 0,
  ), 0);
}

export function countCompletedSets(entries: WorkoutExerciseState[]) {
  return entries.reduce((total, entry) => total + entry.sets.filter((set) => set.done).length, 0);
}

export function countWorkingSets(entries: WorkoutExerciseState[]) {
  return entries.reduce((total, entry) => total + entry.sets.filter((set) => set.done && set.type !== 'warmup').length, 0);
}

export function findPreviousExercisePerformance(
  logs: WorkoutLog[], userId: string, exerciseId: string, beforeStartedAt = Number.POSITIVE_INFINITY, machineMemoryId?: string, metric?: ExerciseMetric,
): WorkoutSet[] | null {
  const matches = (entry: WorkoutExerciseState) => entry.exerciseId === exerciseId && entry.machineMemoryId === machineMemoryId && (metric === undefined || getEntryMetric(entry) === metric);
  const hasPerformance = (entry: WorkoutExerciseState) => matches(entry) && entry.sets.some((set) => set.done && isValidSetPerformance(set, getEntryMetric(entry)));
  const previousLog = [...logs]
    .filter((log) => log.userId === userId && log.startedAt < beforeStartedAt)
    .sort((left, right) => right.finishedAt - left.finishedAt)
    .find((log) => log.entries.some(hasPerformance));
  const entry = previousLog?.entries.find(hasPerformance);
  return entry ? entry.sets.filter((set) => set.done && isValidSetPerformance(set, getEntryMetric(entry))) : null;
}

type WorkoutPosition = { exerciseIndex: number; setIndex: number };

function firstPendingSet(entry: WorkoutExerciseState) {
  return entry.skipped ? -1 : entry.sets.findIndex((set) => !set.done);
}

function pendingPositions(workout: ActiveWorkout): WorkoutPosition[] {
  return workout.entries.flatMap((entry, exerciseIndex) => {
    const setIndex = firstPendingSet(entry);
    return setIndex < 0 ? [] : [{ exerciseIndex, setIndex }];
  });
}

function clearRest(workout: ActiveWorkout): ActiveWorkout {
  return { ...workout, restStartedAt: undefined, restEndsAt: undefined,
    restPausedRemainingSeconds: undefined, restNextExerciseId: undefined, restNextSetId: undefined };
}

/** Keep the selected set's identity when edits shift indices. Empty entries use the zero cursor. */
function stabilizeWorkoutCursor(workout: ActiveWorkout, selectedSetId?: string): ActiveWorkout {
  if (workout.entries.length === 0) return { ...workout, exerciseIndex: 0, setIndex: 0 };
  const exerciseIndex = Math.max(0, Math.min(workout.exerciseIndex, workout.entries.length - 1));
  const entry = workout.entries[exerciseIndex];
  const selectedIndex = selectedSetId ? entry.sets.findIndex((set) => set.id === selectedSetId) : -1;
  const setIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, Math.min(workout.setIndex, entry.sets.length - 1));
  return { ...workout, exerciseIndex, setIndex };
}

function reopenWorkout(workout: ActiveWorkout, now: number): ActiveWorkout {
  return { ...workout, completedAt: undefined, pausedDurationMs: (workout.pausedDurationMs ?? 0) + (workout.completedAt === undefined ? 0 : Math.max(0, now - workout.completedAt)) };
}

function moveTo(workout: ActiveWorkout, position: WorkoutPosition): ActiveWorkout {
  return { ...clearRest(workout), ...position, phase: 'set' };
}

/** A supersetted round advances straight to the next exercise; rest starts after its final member. */
function nextPosition(workout: ActiveWorkout): { position: WorkoutPosition; phase: 'set' | 'rest' | 'between' } | null {
  const current = workout.entries[workout.exerciseIndex];
  const pending = pendingPositions(workout);
  if (!current || pending.length === 0) return null;
  if (current.supersetGroupId) {
    const group = pending.filter(({ exerciseIndex }) => workout.entries[exerciseIndex].supersetGroupId === current.supersetGroupId);
    const inRound = group.find(({ exerciseIndex, setIndex }) => exerciseIndex > workout.exerciseIndex && setIndex <= workout.setIndex);
    if (inRound) return { position: inRound, phase: 'set' };
    const nextRound = [...group].sort((left, right) => left.setIndex - right.setIndex || left.exerciseIndex - right.exerciseIndex)[0];
    if (nextRound) return { position: nextRound, phase: 'rest' };
  } else {
    const nextSet = pending.find(({ exerciseIndex }) => exerciseIndex === workout.exerciseIndex);
    if (nextSet) return { position: nextSet, phase: 'rest' };
  }
  const nextExercise = pending.find(({ exerciseIndex }) => exerciseIndex > workout.exerciseIndex) ?? pending[0];
  return { position: nextExercise, phase: 'between' };
}

export function completeCurrentSet(workout: ActiveWorkout, restSeconds: number, completedAt: number): ActiveWorkout {
  const activeEntry = workout.entries[workout.exerciseIndex];
  const activeSet = activeEntry?.sets[workout.setIndex];
  if (workout.phase !== 'set' || workout.pausedAt !== undefined || !activeEntry || !activeSet || activeSet.done || activeEntry.skipped) return workout;
  const metric = getEntryMetric(activeEntry);
  if (!isValidSetPerformance(activeSet, metric) || !isValidSetPerformance(normalizeWorkoutSet(activeSet, metric), metric)) return workout;
  const updated = updateWorkoutSet(workout, activeEntry.id, activeSet.id, { done: true, completedAt });
  const next = nextPosition(updated);
  if (!next) return finishWorkout(updated, completedAt);
  if (next.phase === 'set') return moveTo(updated, next.position);
  const targetEntry = updated.entries[next.position.exerciseIndex];
  const targetSet = targetEntry.sets[next.position.setIndex];
  return { ...updated, phase: next.phase, restTargetSeconds: restSeconds,
    restStartedAt: next.phase === 'rest' ? completedAt : undefined,
    restEndsAt: next.phase === 'rest' ? completedAt + restSeconds * 1000 : undefined,
    restPausedRemainingSeconds: undefined, restNextExerciseId: targetEntry.id, restNextSetId: targetSet.id };
}

function getRestTarget(workout: ActiveWorkout): WorkoutPosition | null {
  const exerciseIndex = workout.entries.findIndex((entry) => entry.id === workout.restNextExerciseId && !entry.skipped);
  const setIndex = exerciseIndex >= 0 ? workout.entries[exerciseIndex].sets.findIndex((set) => set.id === workout.restNextSetId && !set.done) : -1;
  if (setIndex >= 0) return { exerciseIndex, setIndex };
  return nextPosition(workout)?.position ?? pendingPositions(workout)[0] ?? null;
}

export function advanceToNextSet(workout: ActiveWorkout): ActiveWorkout {
  if (workout.phase !== 'rest') return workout;
  const target = getRestTarget(workout);
  return target ? moveTo(workout, target) : workout;
}

export function advanceToNextExercise(workout: ActiveWorkout, restSeconds: number): ActiveWorkout {
  if (workout.phase !== 'between') return workout;
  const target = getRestTarget(workout);
  return target ? { ...moveTo(workout, target), restTargetSeconds: restSeconds } : workout;
}

export function updateWorkoutSet(workout: ActiveWorkout, entryId: string, setId: string, patch: Partial<WorkoutSet>): ActiveWorkout {
  return { ...workout, entries: workout.entries.map((entry) => entry.id === entryId
    ? { ...entry, sets: entry.sets.map((set) => set.id === setId ? normalizeWorkoutSet({ ...set, ...patch, id: set.id, workoutExerciseId: entry.id }, getEntryMetric(entry)) : set) }
    : entry) };
}

export function navigateToExercise(workout: ActiveWorkout, entryId: string, setId?: string, now = Date.now()): ActiveWorkout {
  const exerciseIndex = workout.entries.findIndex((entry) => entry.id === entryId);
  if (exerciseIndex < 0) return workout;
  const entry = workout.entries[exerciseIndex];
  const selected = setId ? entry.sets.findIndex((set) => set.id === setId) : firstPendingSet(entry);
  const cursor = Math.max(0, selected);
  const updated = !entry.skipped && entry.sets[cursor] && !entry.sets[cursor].done ? reopenWorkout(workout, now) : workout;
  return moveTo(updated, { exerciseIndex, setIndex: cursor });
}

export function skipWorkoutExercise(workout: ActiveWorkout, entryId: string, now: number): ActiveWorkout {
  const updated = { ...clearRest(workout), entries: workout.entries.map((entry) => entry.id === entryId ? { ...entry, skipped: true } : entry) };
  const pending = pendingPositions(updated);
  const next = pending.find(({ exerciseIndex }) => exerciseIndex > workout.exerciseIndex) ?? pending[0];
  return next ? moveTo(updated, next) : finishWorkout(updated, now);
}

export function restoreWorkoutExercise(workout: ActiveWorkout, entryId: string, now = Date.now()): ActiveWorkout {
  return navigateToExercise({ ...reopenWorkout(workout, now), entries: workout.entries.map((entry) => entry.id === entryId ? { ...entry, skipped: false } : entry) }, entryId);
}

export function reorderWorkoutExercise(workout: ActiveWorkout, entryId: string, destinationIndex: number): ActiveWorkout {
  const sourceIndex = workout.entries.findIndex((entry) => entry.id === entryId);
  if (sourceIndex < 0) return workout;
  const currentId = workout.entries[workout.exerciseIndex]?.id;
  const entries = [...workout.entries];
  const [entry] = entries.splice(sourceIndex, 1);
  entries.splice(Math.max(0, Math.min(destinationIndex, entries.length)), 0, entry);
  return { ...workout, entries, exerciseIndex: Math.max(0, entries.findIndex((item) => item.id === currentId)) };
}

function createDefaultSet(entryId: string, id: string, now: number, source?: WorkoutSet): WorkoutSet {
  return { ...source, id, workoutExerciseId: entryId, type: source?.type ?? 'normal', targetReps: source?.targetReps ?? 10,
    reps: source?.reps ?? 10, weightKg: source?.weightKg ?? 0, done: false, note: '', createdAt: now, completedAt: undefined, rir: undefined, rpe: undefined };
}

export function appendSetToCurrentExercise(workout: ActiveWorkout, identity: { id: string; createdAt: number }): ActiveWorkout {
  const entry = workout.entries[workout.exerciseIndex];
  if (!entry) return workout;
  const source = entry.sets[workout.setIndex] ?? entry.sets[entry.sets.length - 1];
  const updated = { ...reopenWorkout(workout, identity.createdAt), entries: workout.entries.map((item) => item.id === entry.id
    ? { ...item, skipped: false, sets: [...item.sets, createDefaultSet(item.id, identity.id, identity.createdAt, source)] } : item) };
  return workout.phase === 'complete' || workout.phase === 'between' ? navigateToExercise(updated, entry.id, identity.id) : updated;
}

export function removeWorkoutSet(workout: ActiveWorkout, entryId: string, setId: string, now: number): ActiveWorkout {
  const currentEntry = workout.entries[workout.exerciseIndex];
  const currentSetId = currentEntry?.sets[workout.setIndex]?.id;
  const updated = stabilizeWorkoutCursor({ ...workout, entries: workout.entries.map((entry) => entry.id === entryId
    ? { ...entry, sets: entry.sets.filter((set) => set.id !== setId) } : entry) }, currentSetId);
  const pending = pendingPositions(updated);
  if (pending.length === 0) return finishWorkout(updated, now);
  if (workout.phase === 'rest') {
    const target = getRestTarget(updated);
    if (target) return { ...updated, restNextExerciseId: updated.entries[target.exerciseIndex].id,
      restNextSetId: updated.entries[target.exerciseIndex].sets[target.setIndex].id };
  }
  if (currentEntry?.id !== entryId || currentSetId !== setId) return updated;
  return moveTo(updated, pending.find((position) => position.exerciseIndex === workout.exerciseIndex) ?? pending[0]);
}

export function uncheckWorkoutSet(workout: ActiveWorkout, entryId: string, setId: string, now = Date.now()): ActiveWorkout {
  return navigateToExercise(updateWorkoutSet(reopenWorkout(workout, now), entryId, setId, { done: false, completedAt: undefined }), entryId, setId);
}

export function appendWorkoutExercise(workout: ActiveWorkout, exercise: Exercise, now: number, identity: (prefix: string) => string): ActiveWorkout {
  const id = identity('entry');
  const metric = getExerciseMetric(exercise);
  const source = createDefaultSet(id, identity('set'), now);
  if (metric === 'duration') { source.targetReps = 60; source.durationSeconds = 60; }
  if (metric === 'distance_duration') { source.targetReps = 600; source.durationSeconds = 600; source.distanceKm = 0; }
  const set = normalizeWorkoutSet(source, metric);
  const entry: WorkoutExerciseState = { id, exerciseId: exercise.id, metric, restSeconds: 90, sets: [set] };
  return navigateToExercise({ ...reopenWorkout(workout, now), entries: [...workout.entries, entry] }, id);
}

/** Completed sets stay attached to the old exercise; only the unfinished work is replaced. */
export function replaceWorkoutExercise(workout: ActiveWorkout, entryId: string, replacement: Exercise, now: number, identity: (prefix: string) => string): ActiveWorkout {
  const entry = workout.entries.find((item) => item.id === entryId);
  if (!entry || entry.exerciseId === replacement.id) return workout;
  const completed = entry.sets.filter((set) => set.done);
  const pending = entry.sets.filter((set) => !set.done);
  const id = completed.length > 0 ? identity('entry') : entry.id;
  const metric = getExerciseMetric(replacement);
  const previousMetric = getEntryMetric(entry);
  const sameMetric = previousMetric === metric;
  const isRepMetric = (value: ExerciseMetric) => value === 'weight_reps' || value === 'reps' || value === 'assisted_reps';
  const compatibleTargets = sameMetric || (isRepMetric(previousMetric) && isRepMetric(metric));
  const defaultTarget = metric === 'duration' ? 60 : metric === 'distance_duration' ? 600 : 10;
  const sources = pending.length > 0 ? pending : [createDefaultSet(id, identity('set'), now)];
  const replacementEntry: WorkoutExerciseState = { ...entry, id, exerciseId: replacement.id, metric, skipped: false,
    machineMemoryId: undefined, sets: sources.map((set) => normalizeWorkoutSet({ ...createDefaultSet(id, identity('set'), now, set),
      weightKg: sameMetric ? set.weightKg : 0, reps: compatibleTargets ? set.reps : defaultTarget,
      targetReps: compatibleTargets ? set.targetReps : defaultTarget,
      repRangeMin: compatibleTargets ? set.repRangeMin : undefined,
      repRangeMax: compatibleTargets ? set.repRangeMax : undefined,
      targetRir: compatibleTargets ? set.targetRir : undefined,
      durationSeconds: metric === 'duration' || metric === 'distance_duration' ? (sameMetric ? set.durationSeconds ?? defaultTarget : defaultTarget) : undefined,
      distanceKm: metric === 'distance_duration' ? (sameMetric ? set.distanceKm ?? 0 : 0) : undefined }, metric)) };
  const entries = workout.entries.flatMap((item) => item.id === entryId
    ? completed.length > 0 ? [{ ...item, sets: completed, supersetGroupId: undefined }, replacementEntry] : [replacementEntry]
    : [item]);
  return navigateToExercise({ ...reopenWorkout(workout, now), entries }, replacementEntry.id);
}

export function toggleSupersetWithNext(workout: ActiveWorkout, groupId: string): ActiveWorkout {
  const current = workout.entries[workout.exerciseIndex];
  const next = workout.entries[workout.exerciseIndex + 1];
  if (!current || !next) return workout;
  const existing = current.supersetGroupId;
  const paired = existing !== undefined && next.supersetGroupId === existing;
  return { ...workout, entries: workout.entries.map((entry, index) => {
    if (paired) return entry.supersetGroupId === existing ? { ...entry, supersetGroupId: undefined } : entry;
    if (index === workout.exerciseIndex || index === workout.exerciseIndex + 1) return { ...entry, supersetGroupId: groupId };
    return entry.supersetGroupId !== undefined && (entry.supersetGroupId === existing || entry.supersetGroupId === next.supersetGroupId) ? { ...entry, supersetGroupId: undefined } : entry;
  }) };
}

export function removeWorkoutSuperset(workout: ActiveWorkout, groupId: string): ActiveWorkout {
  return { ...workout, entries: workout.entries.map((entry) => entry.supersetGroupId === groupId ? { ...entry, supersetGroupId: undefined } : entry) };
}

export function getWorkoutElapsedSeconds(workout: ActiveWorkout, now: number) {
  const end = workout.completedAt ?? workout.pausedAt ?? now;
  return Math.max(0, Math.floor((end - workout.startedAt - (workout.pausedDurationMs ?? 0)) / 1000));
}

export function pauseWorkout(workout: ActiveWorkout, now: number): ActiveWorkout {
  return workout.pausedAt !== undefined || workout.completedAt !== undefined ? workout : { ...pauseRestTimer(workout, now), pausedAt: now };
}

export function resumeWorkout(workout: ActiveWorkout, now: number): ActiveWorkout {
  if (workout.pausedAt === undefined) return workout;
  return { ...resumeRestTimer(workout, now), pausedAt: undefined, pausedDurationMs: (workout.pausedDurationMs ?? 0) + Math.max(0, now - workout.pausedAt) };
}

export function adjustWorkoutDuration(workout: ActiveWorkout, durationSeconds: number, now: number): ActiveWorkout {
  const end = workout.completedAt ?? workout.pausedAt ?? now;
  const duration = Math.max(0, Math.round(durationSeconds));
  return { ...workout, startedAt: end - duration * 1000, pausedDurationMs: 0 };
}

export function finishWorkout(workout: ActiveWorkout, now: number): ActiveWorkout {
  const completedAt = workout.completedAt ?? workout.pausedAt ?? now;
  return { ...clearRest(stabilizeWorkoutCursor(workout)), phase: 'complete', completedAt, pausedAt: undefined };
}

export function createWorkoutLog(workout: ActiveWorkout, finishedAt = Date.now(), date?: string): WorkoutLog {
  const ended = finishWorkout(workout, finishedAt);
  const entries = ended.entries.map((entry) => ({ ...entry, sets: entry.sets.filter((set) => set.done).map((set) => ({ ...set })) })).filter((entry) => entry.sets.length > 0);
  const started = new Date(ended.startedAt);
  const localDate = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}-${String(started.getDate()).padStart(2, '0')}`;
  return { id: ended.id, userId: ended.userId, dayId: ended.dayId, templateId: ended.templateId, name: ended.name,
    notes: ended.notes, date: date ?? localDate, startedAt: ended.startedAt, finishedAt: ended.completedAt ?? finishedAt,
    volumeKg: calculateWorkoutVolume(entries), durationSeconds: getWorkoutElapsedSeconds(ended, finishedAt), entries };
}

export type WorkoutShorteningProposal = {
  removeSetIds: string[];
  skipEntryIds: string[];
  estimatedSeconds: number;
  budgetSeconds: number;
  originalEstimatedSeconds: number;
  retainedPendingSets: number;
  deadlineAt: number;
};

function estimatedSetDuration(workout: ActiveWorkout) {
  const timestamps = workout.entries.flatMap((entry) => entry.sets.flatMap((set) => set.done && set.completedAt ? [set.completedAt] : [])).sort((left, right) => left - right);
  if (timestamps.length < 2) return 45;
  const gaps = timestamps.slice(1).map((time, index) => Math.max(0, (time - timestamps[index]) / 1000 - workout.restTargetSeconds)).filter((gap) => gap > 0);
  if (gaps.length === 0) return 45;
  return Math.max(25, Math.min(120, gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length));
}

/** Uses observed pace and exercise order as priority. Completed work is never discarded. */
export function suggestWorkoutShortening(workout: ActiveWorkout, minutes: number, now: number): WorkoutShorteningProposal {
  const budgetSeconds = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes * 60 : 0));
  const tempo = estimatedSetDuration(workout);
  const queue: { entry: WorkoutExerciseState; set: WorkoutSet; seconds: number; recoverySeconds: number }[] = [];
  const handledGroups = new Set<string>();
  for (const entry of workout.entries) {
    if (entry.skipped) continue;
    if (entry.supersetGroupId && handledGroups.has(entry.supersetGroupId)) continue;
    const group = entry.supersetGroupId ? workout.entries.filter((item) => item.supersetGroupId === entry.supersetGroupId && !item.skipped) : [entry];
    if (entry.supersetGroupId) handledGroups.add(entry.supersetGroupId);
    const rounds = Math.max(0, ...group.map((item) => item.sets.length));
    for (let round = 0; round < rounds; round += 1) {
      const members = group.flatMap((item) => {
        const set = item.sets[round];
        return set && !set.done ? [{ entry: item, set }] : [];
      });
      members.forEach((member, index) => {
        const recoverySeconds = index === members.length - 1 ? member.entry.restSeconds ?? workout.restTargetSeconds : 0;
        queue.push({ ...member, seconds: (member.set.durationSeconds ?? tempo) + recoverySeconds, recoverySeconds });
      });
    }
  }
  // No recovery interval is needed after the last retained set.
  const recovery = (item: typeof queue[number]) => item.recoverySeconds;
  const estimate = (items: typeof queue) => Math.max(0, items.reduce((sum, item) => sum + item.seconds, 0) - (items.length > 0 ? recovery(items[items.length - 1]) : 0));
  const initialRest = workout.phase === 'rest' ? Math.max(0, getRestTimerRemaining(workout, now)) : 0;
  const retained: typeof queue = [];
  for (const item of queue) {
    if (initialRest + estimate([...retained, item]) > budgetSeconds) break;
    retained.push(item);
  }
  const retainedIds = new Set(retained.map(({ set }) => set.id));
  const removeSetIds = queue.filter(({ set }) => !retainedIds.has(set.id)).map(({ set }) => set.id);
  const removeIds = new Set(removeSetIds);
  const skipEntryIds = workout.entries.filter((entry) => !entry.skipped && entry.sets.length > 0 && entry.sets.every((set) => !set.done && removeIds.has(set.id))).map((entry) => entry.id);
  return { removeSetIds, skipEntryIds, estimatedSeconds: retained.length > 0 ? initialRest + estimate(retained) : 0,
    budgetSeconds, originalEstimatedSeconds: queue.length > 0 ? initialRest + estimate(queue) : 0,
    retainedPendingSets: retained.length, deadlineAt: now + budgetSeconds * 1000 };
}

export function applyWorkoutShortening(workout: ActiveWorkout, proposal: WorkoutShorteningProposal, now: number): ActiveWorkout {
  const removed = new Set(proposal.removeSetIds);
  const skipped = new Set(proposal.skipEntryIds);
  const currentId = workout.entries[workout.exerciseIndex]?.id;
  const currentSetId = workout.entries[workout.exerciseIndex]?.sets[workout.setIndex]?.id;
  const updated = stabilizeWorkoutCursor({ ...workout, deadlineAt: proposal.deadlineAt,
    entries: workout.entries.map((entry) => skipped.has(entry.id) && !entry.sets.some((set) => set.done)
      ? { ...entry, skipped: true } : { ...entry, sets: entry.sets.filter((set) => set.done || !removed.has(set.id)) }) }, currentSetId);
  const pending = pendingPositions(updated);
  if (pending.length === 0) return finishWorkout(updated, now);
  const current = updated.entries.find((entry) => entry.id === currentId);
  if (current && !current.skipped && firstPendingSet(current) >= 0) {
    const restTarget = getRestTarget(updated);
    if (workout.phase === 'rest' && restTarget) return { ...updated,
      restNextExerciseId: updated.entries[restTarget.exerciseIndex].id, restNextSetId: updated.entries[restTarget.exerciseIndex].sets[restTarget.setIndex].id };
    return navigateToExercise(updated, current.id);
  }
  return moveTo(updated, pending[0]);
}

export function getRestTimerRemaining(workout: ActiveWorkout, now: number) {
  if (workout.restPausedRemainingSeconds !== undefined) return workout.restPausedRemainingSeconds;
  if (workout.restEndsAt !== undefined) return Math.ceil((workout.restEndsAt - now) / 1000);
  return workout.restTargetSeconds - Math.floor((now - (workout.restStartedAt ?? now)) / 1000);
}

export function pauseRestTimer(workout: ActiveWorkout, now: number): ActiveWorkout {
  if (workout.phase !== 'rest' || workout.restPausedRemainingSeconds !== undefined) return workout;
  return { ...workout, restPausedRemainingSeconds: Math.max(0, getRestTimerRemaining(workout, now)), restEndsAt: undefined };
}

export function resumeRestTimer(workout: ActiveWorkout, now: number): ActiveWorkout {
  if (workout.phase !== 'rest' || workout.restPausedRemainingSeconds === undefined) return workout;
  return { ...workout, restEndsAt: now + workout.restPausedRemainingSeconds * 1000, restPausedRemainingSeconds: undefined };
}

export function adjustRestTimer(workout: ActiveWorkout, adjustmentSeconds: number, now: number): ActiveWorkout {
  if (workout.phase !== 'rest') return workout;
  if (workout.restPausedRemainingSeconds !== undefined) return { ...workout, restPausedRemainingSeconds: Math.max(0, workout.restPausedRemainingSeconds + adjustmentSeconds) };
  const endsAt = workout.restEndsAt ?? now + getRestTimerRemaining(workout, now) * 1000;
  return { ...workout, restEndsAt: Math.max(now, endsAt + adjustmentSeconds * 1000) };
}
