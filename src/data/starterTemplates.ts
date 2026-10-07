import { WorkoutTemplate } from '../types';

export const starterTemplateDefinitions = [
  {
    key: 'full-body-machines',
    name: 'Full body · Machines',
    description: 'A simple first gym workout. Start light, learn the movement and leave 2 reps in reserve.',
    exerciseIds: ['leg-press', 'chest-press', 'lat-pulldown', 'leg-curl', 'plank'],
  },
  {
    key: 'upper-body',
    name: 'Upper body',
    description: 'Balanced pushing and pulling for the upper body. Alternate with Lower body.',
    exerciseIds: ['bench-press', 'seated-row', 'shoulder-press', 'lat-pulldown', 'hammer-curl', 'triceps-pushdown'],
  },
  {
    key: 'lower-body',
    name: 'Lower body',
    description: 'Legs and core. Alternate with Upper body and take a recovery day when you need it.',
    exerciseIds: ['squat', 'rdl', 'leg-extension', 'leg-curl', 'calf-raises', 'plank'],
  },
  {
    key: 'home-bodyweight',
    name: 'Home · Bodyweight',
    description: 'A short equipment-free workout. Set your own comfortable number of reps.',
    exerciseIds: ['lunges', 'glute-bridge', 'crunch', 'plank'],
  },
] as const;

export function createStarterTemplates(
  userId: string,
  now: number,
  createId: () => string,
): WorkoutTemplate[] {
  if (!userId.trim() || !Number.isFinite(now)) {
    throw new Error('Valid starter template identity is required.');
  }
  return starterTemplateDefinitions.map((_definition, index) => createStarterTemplate(index, userId, now, createId));
}

function createStarterTemplate(index: number, userId: string, now: number, createId: () => string): WorkoutTemplate {
  const definition = starterTemplateDefinitions[index];
  if (!definition || !userId.trim() || !Number.isFinite(now)) throw new Error('Valid starter plan and identity are required.');
  return {
    id: createId(),
    userId,
    name: definition.name,
    starterKey: definition.key,
    description: definition.description,
    createdAt: now,
    updatedAt: now,
    archived: false,
    exercises: definition.exerciseIds.map((exerciseId, order) => ({
      id: createId(),
      exerciseId,
      order,
      targetSets: exerciseId === 'plank' ? 2 : 3,
      repRangeMin: exerciseId === 'plank' ? 20 : 8,
      repRangeMax: exerciseId === 'plank' ? 40 : 12,
      targetRir: exerciseId === 'plank' ? undefined : 2,
      restSeconds: exerciseId === 'plank' ? 60 : 90,
    })),
  };
}

/** Recognize older built-in plans too, without conflating unrelated custom plans. */
function matchesLegacyStarter(template: WorkoutTemplate, definition: typeof starterTemplateDefinitions[number]): boolean {
  return template.starterKey === undefined && template.name === definition.name &&
    template.exercises.length === definition.exerciseIds.length &&
    [...template.exercises].sort((a, b) => a.order - b.order).every((entry, position) => entry.exerciseId === definition.exerciseIds[position]);
}

/** Capture a legacy plan's origin before its name or exercise list is edited. */
export function identifyStarterTemplate(template: WorkoutTemplate): WorkoutTemplate {
  const definition = starterTemplateDefinitions.find((starter) => matchesLegacyStarter(template, starter));
  return definition ? { ...template, starterKey: definition.key } : template;
}

export function findStarterTemplate(templates: WorkoutTemplate[], userId: string, index: number): WorkoutTemplate | undefined {
  const definition = starterTemplateDefinitions[index];
  if (!definition) return undefined;
  return templates.find((template) => template.userId === userId && (template.starterKey === definition.key || matchesLegacyStarter(template, definition)));
}

export function addStarterTemplate(templates: WorkoutTemplate[], userId: string, index: number, now: number, createId: () => string): { templates: WorkoutTemplate[]; template: WorkoutTemplate } {
  const definition = starterTemplateDefinitions[index];
  if (!definition || !userId.trim() || !Number.isFinite(now)) throw new Error('Valid starter plan and identity are required.');
  const existing = findStarterTemplate(templates, userId, index);
  const template = existing ? { ...existing, starterKey: definition.key, archived: false, updatedAt: existing.archived ? now : existing.updatedAt } : createStarterTemplate(index, userId, now, createId);
  return { template, templates: existing ? templates.map((item) => item.id === existing.id ? template : item) : [...templates, template] };
}
