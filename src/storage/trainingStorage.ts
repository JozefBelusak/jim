import { exerciseDb } from '../data/exercises';
import { getExerciseMetric } from '../domain/metrics';
import { calculateWorkoutVolume } from '../domain/workouts';
import { normalizeExerciseMediaUrl } from '../domain/exercises';
import {
  ActiveWorkout,
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseMetric,
  MachineMemory,
  MovementType,
  MuscleGroup,
  PlanDay,
  PlanExercise,
  SetType,
  TemplateExercise,
  WorkoutExerciseState,
  WorkoutLog,
  WorkoutPhase,
  WorkoutSet,
  WorkoutTemplate,
  WeightMode,
} from '../types';

export const currentTrainingStorageVersion = 6;
export const previousTrainingStorageVersions = [5, 4, 3, 2] as const;

export type TrainingState = {
  schedule: Record<string, PlanDay>;
  logs: WorkoutLog[];
  activeWorkout: ActiveWorkout | null;
  customExercises: Exercise[];
  templates: WorkoutTemplate[];
  machineMemories?: MachineMemory[];
  onboardingCompleted?: boolean;
};

type TrainingStorageEnvelope = {
  version: typeof currentTrainingStorageVersion;
  savedAt: number;
  data: TrainingState;
};

export function trainingStatesEqual(left: unknown, right: unknown) {
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    isRecord(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  return canonical(left) === canonical(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

const muscleGroups = new Set<MuscleGroup>([
  'chest', 'back', 'lats', 'traps', 'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'adductors',
  'calves', 'abs', 'lower_back', 'cardio',
]);
const equipmentValues = new Set<Equipment>([
  'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'smith_machine',
  'plate_loaded_machine', 'ez_bar', 'pull_up_bar', 'treadmill', 'other',
]);
const exerciseCategories = new Set<ExerciseCategory>(['compound', 'isolation', 'core', 'cardio']);
const movementTypes = new Set<MovementType>([
  'push', 'pull', 'squat', 'hinge', 'lunge', 'calf_raise', 'spinal_flexion',
  'rotation', 'isometric', 'cardio',
]);
const weightModes = new Set<WeightMode>(['external', 'bodyweight', 'bodyweight_plus']);
const setTypes = new Set<SetType>(['warmup', 'normal', 'drop', 'failure']);
const metrics = new Set<ExerciseMetric>(['weight_reps', 'reps', 'duration', 'distance_duration', 'assisted_reps']);
const setNumberKeys = ['repRangeMin', 'repRangeMax', 'targetRir', 'rir', 'rpe', 'durationSeconds', 'distanceKm'] as const;
function isMetric(value: unknown): value is ExerciseMetric {
  return isString(value) && metrics.has(value as ExerciseMetric);
}
function optionalNumbersValid(value: Record<string, unknown>, keys: readonly string[]) {
  return keys.every((key) => value[key] === undefined || (isFiniteNumber(value[key]) && value[key] >= 0));
}
function setExtras(value: Record<string, unknown>): Partial<WorkoutSet> {
  const result: Partial<WorkoutSet> = {};
  for (const key of setNumberKeys) {
    const number = value[key];
    if (isFiniteNumber(number)) result[key] = number;
  }
  return result;
}
function normalizeMachineMemory(value: unknown): MachineMemory | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.exerciseId) ||
      !isString(value.gymName) || !isString(value.machineName) || !isString(value.settings) ||
      !isFiniteNumber(value.lastUsedAt)) return null;
  return { id: value.id, exerciseId: value.exerciseId, gymName: value.gymName,
    machineName: value.machineName, settings: value.settings, lastUsedAt: value.lastUsedAt };
}


function isMuscleGroup(value: unknown): value is MuscleGroup {
  return isString(value) && muscleGroups.has(value as MuscleGroup);
}

function isEquipment(value: unknown): value is Equipment {
  return isString(value) && equipmentValues.has(value as Equipment);
}

function isExerciseCategory(value: unknown): value is ExerciseCategory {
  return isString(value) && exerciseCategories.has(value as ExerciseCategory);
}

function isMovementType(value: unknown): value is MovementType {
  return isString(value) && movementTypes.has(value as MovementType);
}

function isWeightMode(value: unknown): value is WeightMode {
  return isString(value) && weightModes.has(value as WeightMode);
}

function isSafeMedia(value: unknown) {
  if (value === undefined || value === '') return true;
  if (!isString(value)) return false;
  try { normalizeExerciseMediaUrl(value); return true; } catch { return false; }
}
function isCustomExercise(value: unknown): value is Exercise {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    isMuscleGroup(value.primaryMuscle) &&
    Array.isArray(value.secondaryMuscles) &&
    value.secondaryMuscles.every(isMuscleGroup) &&
    isEquipment(value.equipment) &&
    isExerciseCategory(value.category) &&
    isMovementType(value.movementType) &&
    isWeightMode(value.weightMode) &&
    (value.metric === undefined || isMetric(value.metric)) &&
    (value.equipmentAlternatives === undefined || (Array.isArray(value.equipmentAlternatives) && value.equipmentAlternatives.every(isEquipment))) &&
    isOptionalString(value.instructions) &&
    isOptionalString(value.technicalInstructions) &&
    isSafeMedia(value.imageUrl) &&
    isSafeMedia(value.videoUrl) &&
    value.isCustom === true &&
    isString(value.createdBy)
  );
}

function isPlanExercise(value: unknown): value is PlanExercise {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.exerciseId) &&
    isFiniteNumber(value.sets) &&
    isFiniteNumber(value.reps) &&
    isFiniteNumber(value.weightKg) &&
    isFiniteNumber(value.restSeconds) &&
    optionalNumbersValid(value, ['repRangeMin', 'repRangeMax', 'targetRir']) &&
    isOptionalString(value.notes)
  );
}

function isPlanDay(value: unknown): value is PlanDay {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.date) &&
    isString(value.label) &&
    isString(value.focus) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isPlanExercise) &&
    (value.rest === undefined || typeof value.rest === 'boolean')
  );
}

function isTemplateExercise(value: unknown): value is TemplateExercise {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.exerciseId) &&
    isFiniteNumber(value.order) &&
    (value.targetSets === undefined || isFiniteNumber(value.targetSets)) &&
    (value.repRangeMin === undefined || isFiniteNumber(value.repRangeMin)) &&
    (value.repRangeMax === undefined || isFiniteNumber(value.repRangeMax)) &&
    (value.targetRir === undefined || isFiniteNumber(value.targetRir)) &&
    (value.restSeconds === undefined || isFiniteNumber(value.restSeconds)) &&
    isOptionalString(value.notes)
  );
}

function isWorkoutTemplate(value: unknown): value is WorkoutTemplate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.userId) &&
    isString(value.name) &&
    isOptionalString(value.description) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(isTemplateExercise) &&
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt) &&
    (value.archived === undefined || typeof value.archived === 'boolean')
  );
}

function normalizeWorkoutSet(
  value: unknown,
  workoutExerciseId: string,
  fallbackCreatedAt: number,
): WorkoutSet | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isFiniteNumber(value.targetReps) || value.targetReps < 0 ||
    !isFiniteNumber(value.reps) || value.reps < 0 || !Number.isInteger(value.reps) ||
    !isFiniteNumber(value.weightKg) || value.weightKg < 0 ||
    typeof value.done !== 'boolean' ||
    !isOptionalString(value.note) ||
    !optionalNumbersValid(value, setNumberKeys) ||
    (isFiniteNumber(value.rir) && value.rir > 10) ||
    (isFiniteNumber(value.targetRir) && value.targetRir > 10) ||
    (isFiniteNumber(value.rpe) && (value.rpe < 1 || value.rpe > 10))
  ) {
    return null;
  }

  return {
    ...setExtras(value),
    id: value.id,
    workoutExerciseId: isString(value.workoutExerciseId)
      ? value.workoutExerciseId
      : workoutExerciseId,
    type: isString(value.type) && setTypes.has(value.type as SetType)
      ? value.type as SetType
      : 'normal',
    targetReps: value.targetReps,
    reps: value.reps,
    weightKg: value.weightKg,
    done: value.done,
    ...(isString(value.note) ? { note: value.note } : {}),
    createdAt: isFiniteNumber(value.createdAt) ? value.createdAt : fallbackCreatedAt,
    ...(isFiniteNumber(value.completedAt) ? { completedAt: value.completedAt } : {}),
  };
}

function normalizeWorkoutExerciseState(
  value: unknown,
  exerciseIndex: number,
  fallbackCreatedAt: number,
): WorkoutExerciseState | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isString(value.exerciseId) || !Array.isArray(value.sets) ||
      (value.metric !== undefined && !isMetric(value.metric)) ||
      (value.skipped !== undefined && typeof value.skipped !== 'boolean') ||
      !isOptionalString(value.machineMemoryId)) {
    return null;
  }

  const id = isString(value.id)
    ? value.id
    : `legacy-workout-exercise-${exerciseIndex}-${value.exerciseId}`;
  const sets = value.sets.map((set) => normalizeWorkoutSet(set, id, fallbackCreatedAt));

  if (sets.some((set) => set === null)) {
    return null;
  }

  return {
    id,
    exerciseId: value.exerciseId,
    ...(isMetric(value.metric) ? { metric: value.metric } : {}),
    ...(typeof value.skipped === 'boolean' ? { skipped: value.skipped } : {}),
    ...(isString(value.machineMemoryId) ? { machineMemoryId: value.machineMemoryId } : {}),
    ...(isFiniteNumber(value.restSeconds) ? { restSeconds: value.restSeconds } : {}),
    ...(isString(value.notes) ? { notes: value.notes } : {}),
    ...(isString(value.supersetGroupId) ? { supersetGroupId: value.supersetGroupId } : {}),
    sets: sets as WorkoutSet[],
  };
}

function isWorkoutPhase(value: unknown): value is WorkoutPhase {
  return value === 'set' || value === 'rest' || value === 'between' || value === 'complete';
}

function normalizeActiveWorkout(value: unknown): ActiveWorkout | null {
  if (!isRecord(value)) {
    return null;
  }

  const exerciseIndex = value.exerciseIndex;
  const setIndex = value.setIndex;

  if (
    !isString(value.dayId) ||
    !isFiniteNumber(value.startedAt) ||
    !isFiniteNumber(exerciseIndex) ||
    !Number.isInteger(exerciseIndex) ||
    !isFiniteNumber(setIndex) ||
    !Number.isInteger(setIndex) ||
    !isWorkoutPhase(value.phase) ||
    !isFiniteNumber(value.restTargetSeconds) ||
    (value.restStartedAt !== undefined && !isFiniteNumber(value.restStartedAt)) ||
    !Array.isArray(value.entries) ||
    !optionalNumbersValid(value, ['completedAt', 'pausedAt', 'pausedDurationMs', 'deadlineAt']) ||
    !isOptionalString(value.restNextExerciseId) || !isOptionalString(value.restNextSetId)
  ) {
    return null;
  }

  const entries = value.entries.map((entry, entryIndex) =>
    normalizeWorkoutExerciseState(entry, entryIndex, value.startedAt as number),
  );

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  const normalizedEntries = entries as WorkoutExerciseState[];
  const activeEntry = normalizedEntries[exerciseIndex];

  if (
    exerciseIndex < 0 ||
    setIndex < 0 ||
    (normalizedEntries.length === 0 ? exerciseIndex !== 0 || setIndex !== 0 : !activeEntry ||
      (value.phase !== 'complete' && (activeEntry.sets.length === 0 ? setIndex !== 0 : setIndex >= activeEntry.sets.length)))
  ) {
    return null;
  }

  const restStartedAt = isFiniteNumber(value.restStartedAt)
    ? value.restStartedAt
    : undefined;
  const restEndsAt = isFiniteNumber(value.restEndsAt)
    ? value.restEndsAt
    : value.phase === 'rest' && restStartedAt !== undefined
      ? restStartedAt + value.restTargetSeconds * 1000
      : undefined;

  return {
    id: isString(value.id) ? value.id : `legacy-session-${value.startedAt}`,
    userId: isString(value.userId) ? value.userId : 'local-user',
    dayId: value.dayId,
    ...(isString(value.templateId) ? { templateId: value.templateId } : {}),
    name: isString(value.name) ? value.name : 'Workout',
    ...(isString(value.notes) ? { notes: value.notes } : {}),
    startedAt: value.startedAt,
    exerciseIndex,
    setIndex,
    phase: value.phase,
    restTargetSeconds: value.restTargetSeconds,
    ...(restStartedAt !== undefined ? { restStartedAt } : {}),
    ...(restEndsAt !== undefined ? { restEndsAt } : {}),
    ...(isFiniteNumber(value.restPausedRemainingSeconds)
      ? { restPausedRemainingSeconds: value.restPausedRemainingSeconds }
      : {}),
    ...(isFiniteNumber(value.completedAt) ? { completedAt: value.completedAt } : {}),
    ...(isFiniteNumber(value.pausedAt) ? { pausedAt: value.pausedAt } : {}),
    ...(isFiniteNumber(value.pausedDurationMs) ? { pausedDurationMs: value.pausedDurationMs } : {}),
    ...(isFiniteNumber(value.deadlineAt) ? { deadlineAt: value.deadlineAt } : {}),
    ...(isString(value.restNextExerciseId) ? { restNextExerciseId: value.restNextExerciseId } : {}),
    ...(isString(value.restNextSetId) ? { restNextSetId: value.restNextSetId } : {}),
    entries: normalizedEntries,
  };
}

function normalizeWorkoutLog(value: unknown): WorkoutLog | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.dayId) ||
    !isString(value.date) ||
    !isFiniteNumber(value.volumeKg) ||
    !isFiniteNumber(value.durationSeconds) ||
    !Array.isArray(value.entries)
  ) {
    return null;
  }

  const parsedDate = Date.parse(value.date);
  const startedAt = isFiniteNumber(value.startedAt)
    ? value.startedAt
    : Number.isFinite(parsedDate)
      ? parsedDate
      : 0;
  const entries = value.entries.map((entry, entryIndex) =>
    normalizeWorkoutExerciseState(entry, entryIndex, startedAt),
  );

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return {
    id: value.id,
    userId: isString(value.userId) ? value.userId : 'local-user',
    dayId: value.dayId,
    ...(isString(value.templateId) ? { templateId: value.templateId } : {}),
    name: isString(value.name) ? value.name : 'Workout',
    ...(isString(value.notes) ? { notes: value.notes } : {}),
    date: value.date,
    startedAt,
    finishedAt: isFiniteNumber(value.finishedAt)
      ? value.finishedAt
      : startedAt + value.durationSeconds * 1000,
    volumeKg: value.volumeKg,
    durationSeconds: value.durationSeconds,
    entries: entries as WorkoutExerciseState[],
  };
}

export function normalizeTrainingState(value: unknown): TrainingState | null {
  if (!isRecord(value) || !isRecord(value.schedule) || !Array.isArray(value.logs)) {
    return null;
  }

  const schedule: Record<string, PlanDay> = {};
  if (isRecord(value.schedule)) {
    Object.entries(value.schedule).forEach(([date, plan]) => {
      if (isPlanDay(plan)) {
        schedule[date] = plan;
      }
    });
  }

  const logs = Array.isArray(value.logs)
    ? value.logs.map(normalizeWorkoutLog).filter((log): log is WorkoutLog => log !== null)
    : [];
  const activeWorkout = normalizeActiveWorkout(value.activeWorkout);
  const customExercises = Array.isArray(value.customExercises)
    ? value.customExercises.filter(isCustomExercise)
    : [];
  const templates = Array.isArray(value.templates)
    ? value.templates.filter(isWorkoutTemplate)
    : [];

  const memories = Array.isArray(value.machineMemories)
    ? value.machineMemories.map(normalizeMachineMemory).filter((memory): memory is MachineMemory => memory !== null)
    : undefined;
  return { schedule, logs, activeWorkout, customExercises, templates,
    ...(memories ? { machineMemories: memories } : {}),
    ...(typeof value.onboardingCompleted === 'boolean' ? { onboardingCompleted: value.onboardingCompleted } : {}) };

}

export function hasCompleteTrainingRecords(source: unknown, state: TrainingState): boolean {
  const uniqueIds = (items: { id: string }[]) => items.every((item) => item.id.trim().length > 0)
    && new Set(items.map((item) => item.id)).size === items.length;
  const preservesFields = (original: Record<string, unknown>, normalized: object, fields: readonly string[]) => {
    const result = normalized as Record<string, unknown>;
    return fields.every((field) => original[field] === undefined || Object.is(original[field], result[field]));
  };
  const completeEntries = (original: unknown, entries: WorkoutExerciseState[]): boolean => {
    if (!Array.isArray(original) || original.length !== entries.length || !uniqueIds(entries)) return false;
    const sets = entries.flatMap((entry) => entry.sets);
    if (!uniqueIds(sets)) return false;
    return entries.every((entry, index) => {
      const input: unknown = original[index];
      if (!isRecord(input) || !Array.isArray(input.sets) || input.sets.length !== entry.sets.length ||
          !preservesFields(input, entry, ['id', 'exerciseId', 'metric', 'restSeconds', 'notes', 'supersetGroupId', 'skipped', 'machineMemoryId'])) return false;
      const originalSets = input.sets;
      return entry.sets.every((set, setIndex) => {
        const originalSet: unknown = originalSets[setIndex];
        return isRecord(originalSet) && set.workoutExerciseId === entry.id && preservesFields(originalSet, set,
          ['id', 'workoutExerciseId', 'type', 'targetReps', 'reps', 'weightKg', 'done', 'note', 'createdAt', 'completedAt', ...setNumberKeys]);
      });
    });
  };
  if (!isRecord(source) || !isRecord(source.schedule) || !Array.isArray(source.logs)) return false;
  if (Object.keys(source.schedule).length !== Object.keys(state.schedule).length) return false;
  for (const key of ['logs', 'customExercises', 'templates', 'machineMemories'] as const) {
    const original = source[key];
    const normalized = state[key];
    if (original !== undefined && (!Array.isArray(original) || original.length !== (normalized?.length ?? 0))) return false;
    if (normalized && !uniqueIds(normalized)) return false;
  }
  if (source.activeWorkout !== null && source.activeWorkout !== undefined && !state.activeWorkout) return false;
  if (source.onboardingCompleted !== undefined && typeof source.onboardingCompleted !== 'boolean') return false;
  const originalLogs = source.logs;
  if (!state.logs.every((log, index) => {
    const original: unknown = originalLogs[index];
    return isRecord(original) && preservesFields(original, log, ['id', 'userId', 'dayId', 'templateId', 'name', 'notes', 'date', 'startedAt', 'finishedAt', 'durationSeconds'])
      && completeEntries(original.entries, log.entries);
  })) return false;
  if (state.activeWorkout && (!isRecord(source.activeWorkout) || !completeEntries(source.activeWorkout.entries, state.activeWorkout.entries) ||
      !preservesFields(source.activeWorkout, state.activeWorkout, ['id', 'userId', 'dayId', 'templateId', 'name', 'notes', 'startedAt', 'phase', 'exerciseIndex', 'setIndex', 'restTargetSeconds', 'restStartedAt', 'restEndsAt', 'restPausedRemainingSeconds', 'completedAt', 'pausedAt', 'pausedDurationMs', 'deadlineAt', 'restNextExerciseId', 'restNextSetId']))) return false;
  if (!state.templates.every((template) => uniqueIds(template.exercises))) return false;
  return true;
}

export function parseTrainingStorageEnvelope(raw: string): TrainingState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== currentTrainingStorageVersion ||
      !isFiniteNumber(parsed.savedAt) ||
      !isRecord(parsed.data) ||
      !('schedule' in parsed.data) ||
      !('logs' in parsed.data) ||
      !('activeWorkout' in parsed.data) ||
      !('customExercises' in parsed.data) ||
      !('templates' in parsed.data)
    ) {
      return null;
    }

    const state = normalizeTrainingState(parsed.data);
    return state && hasCompleteTrainingRecords(parsed.data, state) ? state : null;
  } catch {
    return null;
  }
}

export function migrateTrainingState(state: TrainingState): TrainingState {
  const catalog = [...exerciseDb, ...state.customExercises];
  const migrateEntry = (entry: WorkoutExerciseState): WorkoutExerciseState => {
    const exercise = catalog.find((item) => item.id === entry.exerciseId);
    const metric = entry.metric ?? (exercise ? getExerciseMetric(exercise) : 'weight_reps');
    if (entry.metric || metric === 'weight_reps') return entry;
    return { ...entry, metric };
  };
  const active = state.activeWorkout;
  const migratedActive = active ? { ...active, entries: active.entries.map(migrateEntry),
    ...(active.phase === 'complete' && active.completedAt === undefined
      ? { completedAt: Math.max(active.startedAt, ...active.entries.flatMap((entry) => entry.sets.map((set) => set.completedAt ?? active.startedAt))) }
      : {}) } : null;
  return { ...state, activeWorkout: migratedActive,
    logs: state.logs.map((log) => { const entries = log.entries.map(migrateEntry); return { ...log, entries, volumeKg: calculateWorkoutVolume(entries) }; }) };
}

export function parsePreviousTrainingStorageEnvelope(raw: string): TrainingState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !previousTrainingStorageVersions.includes(
        parsed.version as (typeof previousTrainingStorageVersions)[number],
      ) ||
      !isFiniteNumber(parsed.savedAt) ||
      !isRecord(parsed.data)
    ) {
      return null;
    }

    const state = normalizeTrainingState(parsed.data);
    return state ? migrateTrainingState(state) : null;
  } catch {
    return null;
  }
}

export function parseLegacyTrainingStorage(raw: string): TrainingState | null {
  try {
    const state = normalizeTrainingState(JSON.parse(raw) as unknown);
    return state ? migrateTrainingState(state) : null;
  } catch {
    return null;
  }
}

export function serializeTrainingState(state: TrainingState, savedAt = Date.now()) {
  const envelope: TrainingStorageEnvelope = {
    version: currentTrainingStorageVersion,
    savedAt,
    data: state,
  };

  return JSON.stringify(envelope);
}
