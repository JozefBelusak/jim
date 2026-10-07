import { ExerciseMetric, PlanDay, TemplateExercise, WorkoutLog, WorkoutTemplate } from '../types';

export function getNextWorkoutTemplate(
  templates: WorkoutTemplate[],
  logs: WorkoutLog[],
  userId: string,
) {
  const userTemplates = templates.filter((template) => template.userId === userId && !template.archived);
  if (userTemplates.length === 0) {
    return null;
  }

  const templateIds = new Set(userTemplates.map((template) => template.id));
  const lastTemplateId = [...logs]
    .filter(
      (log) => log.userId === userId && log.templateId && templateIds.has(log.templateId),
    )
    .sort((left, right) => right.finishedAt - left.finishedAt)[0]?.templateId;
  const lastIndex = userTemplates.findIndex((template) => template.id === lastTemplateId);

  return userTemplates[(lastIndex + 1) % userTemplates.length];
}

export function createWorkoutTemplate(
  input: { name: string; description?: string },
  identity: { id: string; userId: string; createdAt: number },
): WorkoutTemplate {
  const name = input.name.trim();
  if (!name || !identity.id.trim() || !identity.userId.trim()) {
    throw new Error('Template name and identity are required.');
  }

  return {
    id: identity.id,
    userId: identity.userId,
    name,
    description: normalizeOptionalText(input.description),
    exercises: [],
    createdAt: identity.createdAt,
    updatedAt: identity.createdAt,
  };
}

export function updateWorkoutTemplateDetails(
  template: WorkoutTemplate,
  patch: { name?: string; description?: string },
  updatedAt: number,
): WorkoutTemplate {
  const name = patch.name === undefined ? template.name : patch.name.trim();
  if (!name) {
    throw new Error('Template name is required.');
  }

  return {
    ...template,
    name,
    description:
      patch.description === undefined
        ? template.description
        : normalizeOptionalText(patch.description),
    updatedAt,
  };
}

export function addExerciseToTemplate(
  template: WorkoutTemplate,
  exerciseId: string,
  templateExerciseId: string,
  updatedAt: number,
  metric: ExerciseMetric = 'weight_reps',
): WorkoutTemplate {
  if (!exerciseId.trim() || !templateExerciseId.trim()) {
    throw new Error('Exercise identity is required.');
  }
  if (template.exercises.some((item) => item.id === templateExerciseId)) {
    throw new Error('Template exercise IDs must be unique.');
  }

  const exercise: TemplateExercise = {
    id: templateExerciseId,
    exerciseId,
    order: template.exercises.length,
    targetSets: metric === 'distance_duration' ? 1 : metric === 'duration' ? 2 : 3,
    repRangeMin: metric === 'distance_duration' ? 600 : metric === 'duration' ? 20 : 8,
    repRangeMax: metric === 'distance_duration' ? 600 : metric === 'duration' ? 40 : 12,
    restSeconds: metric === 'distance_duration' ? 0 : 90,
  };

  return {
    ...template,
    exercises: [...template.exercises, exercise],
    updatedAt,
  };
}

export function updateTemplateExercise(
  template: WorkoutTemplate,
  templateExerciseId: string,
  patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>,
  updatedAt: number,
): WorkoutTemplate {
  return {
    ...template,
    exercises: template.exercises.map((item) =>
      item.id === templateExerciseId ? normalizeTemplateExercise(item, patch) : item,
    ),
    updatedAt,
  };
}

export function removeExerciseFromTemplate(
  template: WorkoutTemplate,
  templateExerciseId: string,
  updatedAt: number,
): WorkoutTemplate {
  const exercises = template.exercises
    .filter((item) => item.id !== templateExerciseId)
    .map((item, order) => ({ ...item, order }));

  return { ...template, exercises, updatedAt };
}

export function moveExerciseInTemplate(
  template: WorkoutTemplate,
  templateExerciseId: string,
  direction: -1 | 1,
  updatedAt: number,
): WorkoutTemplate {
  const fromIndex = template.exercises.findIndex((item) => item.id === templateExerciseId);
  const toIndex = fromIndex + direction;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= template.exercises.length) {
    return template;
  }

  const exercises = [...template.exercises];
  const [moved] = exercises.splice(fromIndex, 1);
  exercises.splice(toIndex, 0, moved);

  return {
    ...template,
    exercises: exercises.map((item, order) => ({ ...item, order })),
    updatedAt,
  };
}

export function duplicateWorkoutTemplate(
  template: WorkoutTemplate,
  identity: {
    id: string;
    userId: string;
    createdAt: number;
    templateExerciseIds: string[];
  },
): WorkoutTemplate {
  if (identity.templateExerciseIds.length !== template.exercises.length) {
    throw new Error('A new ID is required for every duplicated template exercise.');
  }

  return {
    ...template,
    id: identity.id,
    userId: identity.userId,
    name: `${template.name} Copy`,
    starterKey: undefined,
    archived: false,
    exercises: template.exercises.map((item, order) => ({
      ...item,
      id: identity.templateExerciseIds[order],
      order,
    })),
    createdAt: identity.createdAt,
    updatedAt: identity.createdAt,
  };
}

export function templateToPlanDay(template: WorkoutTemplate, date: string): PlanDay {
  return {
    id: date,
    date,
    label: template.name,
    focus: template.description ?? 'Workout template',
    exercises: [...template.exercises]
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        exerciseId: item.exerciseId,
        sets: item.targetSets ?? 3,
        reps: item.repRangeMax ?? item.repRangeMin ?? 10,
        weightKg: 0,
        restSeconds: item.restSeconds ?? 90,
        repRangeMin: item.repRangeMin,
        repRangeMax: item.repRangeMax,
        targetRir: item.targetRir,
        notes: item.notes,
      })),
  };
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function setTemplateArchived(
  template: WorkoutTemplate,
  archived: boolean,
  updatedAt: number,
): WorkoutTemplate {
  return { ...template, archived, updatedAt };
}

export function moveTemplate(
  templates: WorkoutTemplate[],
  templateId: string,
  direction: -1 | 1,
): WorkoutTemplate[] {
  const index = templates.findIndex((template) => template.id === templateId);
  if (index < 0) return templates;
  const visibleIndices = templates.flatMap((template, position) => Boolean(template.archived) === Boolean(templates[index].archived) ? [position] : []);
  const visibleIndex = visibleIndices.indexOf(index);
  const adjacentIndex = visibleIndices[visibleIndex + direction];
  if (adjacentIndex === undefined) return templates;
  const result = [...templates];
  [result[index], result[adjacentIndex]] = [result[adjacentIndex], result[index]];
  return result;
}

function normalizeTemplateExercise(
  item: TemplateExercise,
  patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>,
): TemplateExercise {
  const result = { ...item, ...patch };
  for (const key of ['targetSets', 'repRangeMin', 'repRangeMax', 'restSeconds', 'targetRir'] as const) {
    const value = result[key];
    const minimum = key === 'restSeconds' || key === 'targetRir' ? 0 : 1;
    if (value !== undefined && (!Number.isFinite(value) || value < minimum || !Number.isInteger(value))) {
      throw new Error(`Invalid ${key}.`);
    }
  }
  if (result.targetRir !== undefined && result.targetRir > 10) {
    throw new Error('Target RIR must be between 0 and 10.');
  }
  if (result.repRangeMin !== undefined && result.repRangeMax !== undefined && result.repRangeMin > result.repRangeMax) {
    if (patch.repRangeMin !== undefined && patch.repRangeMax !== undefined) {
      throw new Error('Minimum reps cannot exceed maximum reps.');
    }
    if (patch.repRangeMin !== undefined) {
      result.repRangeMax = result.repRangeMin;
    } else {
      result.repRangeMin = result.repRangeMax;
    }
  }
  result.notes = normalizeOptionalText(result.notes);
  return result;
}
