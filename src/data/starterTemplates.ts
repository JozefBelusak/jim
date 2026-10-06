import { WorkoutTemplate } from '../types';

export const starterTemplateDefinitions = [
  {
    name: 'Full body · Machines',
    description: 'A simple first gym workout. Start light, learn the movement and leave 2 reps in reserve.',
    exerciseIds: ['leg-press', 'chest-press', 'lat-pulldown', 'leg-curl', 'plank'],
  },
  {
    name: 'Upper body',
    description: 'Balanced pushing and pulling for the upper body. Alternate with Lower body.',
    exerciseIds: ['bench-press', 'seated-row', 'shoulder-press', 'lat-pulldown', 'hammer-curl', 'triceps-pushdown'],
  },
  {
    name: 'Lower body',
    description: 'Legs and core. Alternate with Upper body and take a recovery day when you need it.',
    exerciseIds: ['squat', 'rdl', 'leg-extension', 'leg-curl', 'calf-raises', 'plank'],
  },
  {
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
  return starterTemplateDefinitions.map((definition) => ({
    id: createId(),
    userId,
    name: definition.name,
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
  }));
}
