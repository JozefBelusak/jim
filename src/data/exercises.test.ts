import { describe, expect, it } from 'vitest';

import { exerciseDb } from './exercises';

describe('built-in exercise catalog', () => {
  it('preserves all existing exercise IDs without duplicates', () => {
    const ids = exerciseDb.map((exercise) => exercise.id);

    expect(exerciseDb).toHaveLength(49);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('bench-press');
    expect(ids).toContain('pull-up');
    expect(ids).toContain('treadmill-walk');
  });

  it('provides the complete typed model for every built-in exercise', () => {
    exerciseDb.forEach((exercise) => {
      expect(exercise.name.length).toBeGreaterThan(0);
      expect(exercise.primaryMuscle.length).toBeGreaterThan(0);
      expect(exercise.equipment.length).toBeGreaterThan(0);
      expect(exercise.category.length).toBeGreaterThan(0);
      expect(exercise.movementType.length).toBeGreaterThan(0);
      expect(exercise.weightMode.length).toBeGreaterThan(0);
      expect(exercise.instructions?.length).toBeGreaterThan(0);
      expect(exercise.technicalInstructions?.length).toBeGreaterThan(0);
      expect(exercise.isCustom).toBe(false);
    });
  });

  it('normalizes representative compound, isolation, and bodyweight exercises', () => {
    expect(exerciseDb.find((exercise) => exercise.id === 'bench-press')).toMatchObject({
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps', 'front_delts'],
      equipment: 'barbell',
      category: 'compound',
      movementType: 'push',
      weightMode: 'external',
    });
    expect(exerciseDb.find((exercise) => exercise.id === 'lateral-raises')).toMatchObject({
      primaryMuscle: 'side_delts',
      category: 'isolation',
    });
    expect(exerciseDb.find((exercise) => exercise.id === 'pull-up')).toMatchObject({
      primaryMuscle: 'lats',
      equipment: 'pull_up_bar',
      weightMode: 'bodyweight_plus',
    });
  });
});
