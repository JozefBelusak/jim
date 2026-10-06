import {
  Equipment,
  Exercise,
  ExerciseCategory,
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
    imageUrl: normalizeOptionalText(input.imageUrl),
    videoUrl: normalizeOptionalText(input.videoUrl),
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
    ...Array.from(new Set(exercises.map((exercise) => exercise.equipment))),
  ] satisfies EquipmentFilter[];
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters) {
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase() ?? '';

  return exercises.filter((exercise) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      exercise.name.toLocaleLowerCase().includes(normalizedQuery);
    const matchesMuscle =
      !filters.muscle ||
      filters.muscle === allMusclesFilter ||
      exercise.primaryMuscle === filters.muscle;
    const matchesEquipment =
      !filters.equipment ||
      filters.equipment === allEquipmentFilter ||
      exercise.equipment === filters.equipment;

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
