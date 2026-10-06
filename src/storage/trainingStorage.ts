import {
  ActiveWorkout,
  Equipment,
  Exercise,
  ExerciseCategory,
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

export const currentTrainingStorageVersion = 5;
export const previousTrainingStorageVersions = [4, 3, 2] as const;

export type TrainingState = {
  schedule: Record<string, PlanDay>;
  logs: WorkoutLog[];
  activeWorkout: ActiveWorkout | null;
  customExercises: Exercise[];
  templates: WorkoutTemplate[];
};

type TrainingStorageEnvelope = {
  version: typeof currentTrainingStorageVersion;
  savedAt: number;
  data: TrainingState;
};

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
    isOptionalString(value.instructions) &&
    isOptionalString(value.technicalInstructions) &&
    isOptionalString(value.imageUrl) &&
    isOptionalString(value.videoUrl) &&
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
    isFiniteNumber(value.restSeconds)
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
    isFiniteNumber(value.updatedAt)
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
    !isFiniteNumber(value.targetReps) ||
    !isFiniteNumber(value.reps) ||
    !isFiniteNumber(value.weightKg) ||
    typeof value.done !== 'boolean' ||
    !isOptionalString(value.note)
  ) {
    return null;
  }

  return {
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

  if (!isString(value.exerciseId) || !Array.isArray(value.sets)) {
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
    !Array.isArray(value.entries)
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
    !activeEntry ||
    setIndex >= activeEntry.sets.length
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

function normalizeTrainingState(value: unknown): TrainingState | null {
  if (!isRecord(value)) {
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

  return { schedule, logs, activeWorkout, customExercises, templates };
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

    return normalizeTrainingState(parsed.data);
  } catch {
    return null;
  }
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

    return normalizeTrainingState(parsed.data);
  } catch {
    return null;
  }
}

export function parseLegacyTrainingStorage(raw: string): TrainingState | null {
  try {
    return normalizeTrainingState(JSON.parse(raw) as unknown);
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
