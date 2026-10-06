import { describe, expect, it } from 'vitest';

import { Exercise } from '../types';
import {
  createCustomExercise,
  filterExercises,
  formatEquipment,
  formatMuscleGroup,
  getEquipmentFilters,
  getMuscleFilters,
  updateCustomExercise,
} from './exercises';

const exercises: Exercise[] = [
  {
    id: 'press',
    name: 'Chest Press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    equipment: 'machine',
    category: 'compound',
    movementType: 'push',
    weightMode: 'external',
    isCustom: false,
  },
  {
    id: 'fly',
    name: 'Cable Fly',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'cable',
    category: 'isolation',
    movementType: 'push',
    weightMode: 'external',
    isCustom: false,
  },
  {
    id: 'row',
    name: 'Seated Row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    equipment: 'cable',
    category: 'compound',
    movementType: 'pull',
    weightMode: 'external',
    isCustom: false,
  },
];

describe('exercise filters', () => {
  it('creates unique muscle filters in database order', () => {
    expect(getMuscleFilters(exercises)).toEqual(['all', 'chest', 'back']);
    expect(getEquipmentFilters(exercises)).toEqual(['all', 'machine', 'cable']);
  });

  it('combines name, muscle, and equipment filters', () => {
    expect(filterExercises(exercises, { muscle: 'chest' })).toEqual(exercises.slice(0, 2));
    expect(filterExercises(exercises, { query: 'row', equipment: 'cable' })).toEqual([exercises[2]]);
    expect(filterExercises(exercises, { query: 'press', equipment: 'cable' })).toEqual([]);
  });

  it('formats stable enum values for display', () => {
    expect(formatMuscleGroup('rear_delts')).toBe('Rear delts');
    expect(formatEquipment('smith_machine')).toBe('Smith machine');
  });
});

describe('custom exercises', () => {
  const input = {
    name: '  My cable press  ',
    primaryMuscle: 'chest' as const,
    equipment: 'cable' as const,
    category: 'compound' as const,
    movementType: 'push' as const,
    weightMode: 'external' as const,
    instructions: '  Keep elbows stable.  ',
  };

  it('creates a normal exercise with a stable supplied ID', () => {
    expect(createCustomExercise(input, { id: 'custom-1', userId: 'local-user' })).toEqual({
      ...input,
      id: 'custom-1',
      name: 'My cable press',
      secondaryMuscles: [],
      instructions: 'Keep elbows stable.',
      technicalInstructions: undefined,
      imageUrl: undefined,
      videoUrl: undefined,
      isCustom: true,
      createdBy: 'local-user',
    });
  });

  it('keeps ID and ownership when the owner edits an exercise', () => {
    const exercise = createCustomExercise(input, { id: 'custom-1', userId: 'local-user' });
    const updated = updateCustomExercise(
      exercise,
      { ...input, name: 'Updated press' },
      'local-user',
    );

    expect(updated.id).toBe('custom-1');
    expect(updated.createdBy).toBe('local-user');
    expect(updated.name).toBe('Updated press');
  });

  it('rejects empty names and edits by a different user', () => {
    expect(() => createCustomExercise({ ...input, name: ' ' }, { id: 'custom-1', userId: 'local-user' })).toThrow('Exercise name is required.');
    const exercise = createCustomExercise(input, { id: 'custom-1', userId: 'local-user' });
    expect(() => updateCustomExercise(exercise, input, 'other-user')).toThrow(
      'Only the owner can edit a custom exercise.',
    );
  });
});
