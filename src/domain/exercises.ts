import {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseMetric,
  MovementType,
  MuscleGroup,
  WeightMode,
} from '../types';

export const allMusclesFilter = 'all';
export const allEquipmentFilter = 'all';

export type MuscleFilter = MuscleGroup | typeof allMusclesFilter;
export type EquipmentFilter = Equipment | typeof allEquipmentFilter;

export type ExerciseFilters = {
  query?: string;
  muscle?: MuscleFilter;
  equipment?: EquipmentFilter;
};

export type CustomExerciseInput = {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  movementType: MovementType;
  weightMode: WeightMode;
  instructions?: string;
  technicalInstructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  metric?: ExerciseMetric;
  equipmentAlternatives?: Equipment[];
};

export const muscleGroupOptions: readonly MuscleGroup[] = [
  'chest',
  'back',
  'lats',
  'traps',
  'front_delts',
  'side_delts',
  'rear_delts',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'calves',
  'abs',
  'lower_back',
  'cardio',
];

export const equipmentOptions: readonly Equipment[] = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'smith_machine',
  'plate_loaded_machine',
  'ez_bar',
  'pull_up_bar',
  'treadmill',
  'other',
];

export function createCustomExercise(
  input: CustomExerciseInput,
  identity: { id: string; userId: string },
): Exercise {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Exercise name is required.');
  }

  if (!identity.id.trim() || !identity.userId.trim()) {
    throw new Error('Custom exercise identity is required.');
  }

  return {
    ...input,
    id: identity.id,
    name,
    secondaryMuscles: [...(input.secondaryMuscles ?? [])],
    instructions: normalizeOptionalText(input.instructions),
    technicalInstructions: normalizeOptionalText(input.technicalInstructions),
    imageUrl: normalizeExerciseMediaUrl(input.imageUrl),
    videoUrl: normalizeExerciseMediaUrl(input.videoUrl),
    ...(input.equipmentAlternatives ? { equipmentAlternatives: [...new Set(input.equipmentAlternatives)].filter((equipment) => equipment !== input.equipment) } : {}),
    isCustom: true,
    createdBy: identity.userId,
  };
}

export function updateCustomExercise(
  exercise: Exercise,
  input: CustomExerciseInput,
  userId: string,
) {
  if (!exercise.isCustom || exercise.createdBy !== userId) {
    throw new Error('Only the owner can edit a custom exercise.');
  }

  return createCustomExercise(input, { id: exercise.id, userId });
}

export function getMuscleFilters(exercises: Exercise[]) {
  return [
    allMusclesFilter,
    ...Array.from(new Set(exercises.map((exercise) => exercise.primaryMuscle))),
  ] satisfies MuscleFilter[];
}

export function getEquipmentFilters(exercises: Exercise[]) {
  return [
    allEquipmentFilter,
    ...Array.from(new Set(exercises.flatMap((exercise) => [exercise.equipment, ...(exercise.equipmentAlternatives ?? [])]))),
  ] satisfies EquipmentFilter[];
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters) {
  const tokens = normalizeSearch(filters.query ?? '').split(/\s+/).filter(Boolean);

  return exercises.filter((exercise) => {
    const matchesQuery =
      tokens.length === 0 ||
      tokens.every((token) => normalizeSearch([exercise.name, formatMuscleGroup(exercise.primaryMuscle), ...exercise.secondaryMuscles.map(formatMuscleGroup), formatEquipment(exercise.equipment), ...(exercise.equipmentAlternatives ?? []).map(formatEquipment)].join(' ')).includes(token));
    const matchesMuscle =
      !filters.muscle ||
      filters.muscle === allMusclesFilter ||
      exercise.primaryMuscle === filters.muscle ||
      exercise.secondaryMuscles.includes(filters.muscle);
    const matchesEquipment =
      !filters.equipment ||
      filters.equipment === allEquipmentFilter ||
      exercise.equipment === filters.equipment ||
      Boolean(exercise.equipmentAlternatives?.includes(filters.equipment));

    return matchesQuery && matchesMuscle && matchesEquipment;
  });
}

export function formatMuscleGroup(muscle: MuscleGroup) {
  return formatToken(muscle);
}

export function formatEquipment(equipment: Equipment) {
  const labels: Partial<Record<Equipment, string>> = {
    ez_bar: 'EZ bar',
    smith_machine: 'Smith machine',
    plate_loaded_machine: 'Plate loaded',
    pull_up_bar: 'Pull-up bar',
  };

  return labels[equipment] ?? formatToken(equipment);
}

function formatToken(value: string) {
  const label = value.replaceAll('_', ' ');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export const exerciseMetricOptions: readonly ExerciseMetric[] = [
  'weight_reps', 'reps', 'duration', 'distance_duration', 'assisted_reps',
];

export function formatExerciseMetric(metric: ExerciseMetric) {
  const labels: Record<ExerciseMetric, string> = {
    weight_reps: 'Weight + reps',
    reps: 'Reps only',
    duration: 'Time (seconds)',
    distance_duration: 'Distance + time',
    assisted_reps: 'Assistance + reps',
  };
  return labels[metric];
}

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

export function normalizeExerciseMediaUrl(value: string | undefined) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return undefined;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // The form shows the validation message without storing an unsafe URL.
  }
  throw new Error('Media URLs must start with https:// or http://.');
}
