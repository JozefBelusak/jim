import { describe, expect, it } from 'vitest';

import {
  addExerciseToTemplate,
  createWorkoutTemplate,
  duplicateWorkoutTemplate,
  getNextWorkoutTemplate,
  moveExerciseInTemplate,
  removeExerciseFromTemplate,
  templateToPlanDay,
  updateTemplateExercise,
  updateWorkoutTemplateDetails,
} from './templates';
import { WorkoutLog } from '../types';

function createTemplate() {
  return createWorkoutTemplate(
    { name: ' Pull ', description: ' Back and biceps ' },
    { id: 'template-1', userId: 'user-1', createdAt: 100 },
  );
}

describe('workout templates', () => {
  it('creates and renames a normalized template', () => {
    const template = createTemplate();
    const renamed = updateWorkoutTemplateDetails(
      template,
      { name: ' Pull A ', description: ' ' },
      200,
    );

    expect(template).toMatchObject({ name: 'Pull', description: 'Back and biceps' });
    expect(renamed).toMatchObject({ name: 'Pull A', description: undefined, updatedAt: 200 });
  });

  it('adds, edits, moves, and removes exercises while keeping contiguous order', () => {
    let template = addExerciseToTemplate(createTemplate(), 'lat-pulldown', 'item-1', 200);
    template = addExerciseToTemplate(template, 'seated-row', 'item-2', 300);
    template = updateTemplateExercise(template, 'item-1', { targetSets: 4, restSeconds: 120 }, 400);
    template = moveExerciseInTemplate(template, 'item-2', -1, 500);

    expect(template.exercises.map((item) => [item.exerciseId, item.order])).toEqual([
      ['seated-row', 0],
      ['lat-pulldown', 1],
    ]);
    expect(template.exercises[1]).toMatchObject({ targetSets: 4, restSeconds: 120 });

    template = removeExerciseFromTemplate(template, 'item-2', 600);
    expect(template.exercises).toHaveLength(1);
    expect(template.exercises[0].order).toBe(0);
  });

  it('does not add the same exercise twice', () => {
    const template = addExerciseToTemplate(createTemplate(), 'lat-pulldown', 'item-1', 200);
    expect(addExerciseToTemplate(template, 'lat-pulldown', 'item-2', 300)).toBe(template);
  });

  it('duplicates with new template and item IDs', () => {
    const template = addExerciseToTemplate(createTemplate(), 'lat-pulldown', 'item-1', 200);
    const duplicate = duplicateWorkoutTemplate(template, {
      id: 'template-2',
      userId: 'user-1',
      createdAt: 500,
      templateExerciseIds: ['item-2'],
    });

    expect(duplicate).toMatchObject({ id: 'template-2', name: 'Pull Copy', createdAt: 500 });
    expect(duplicate.exercises[0].id).toBe('item-2');
  });

  it('converts a template to the existing workout plan flow', () => {
    let template = addExerciseToTemplate(createTemplate(), 'lat-pulldown', 'item-1', 200);
    template = updateTemplateExercise(
      template,
      'item-1',
      { targetSets: 4, repRangeMin: 8, repRangeMax: 12, restSeconds: 150 },
      300,
    );

    expect(templateToPlanDay(template, '2026-08-14')).toMatchObject({
      id: '2026-08-14',
      label: 'Pull',
      exercises: [{ exerciseId: 'lat-pulldown', sets: 4, reps: 12, weightKg: 0, restSeconds: 150 }],
    });
  });

  it('suggests the next template after the most recently completed one', () => {
    const pull = createTemplate();
    const push = { ...createTemplate(), id: 'template-2', name: 'Push' };
    const legs = { ...createTemplate(), id: 'template-3', name: 'Legs' };
    const log: WorkoutLog = {
      id: 'log-1',
      userId: 'user-1',
      dayId: '2026-08-14',
      templateId: push.id,
      name: push.name,
      date: '2026-08-14',
      startedAt: 1,
      finishedAt: 2,
      volumeKg: 0,
      durationSeconds: 1,
      entries: [],
    };

    expect(getNextWorkoutTemplate([pull, push, legs], [log], 'user-1')?.id).toBe(legs.id);
    expect(getNextWorkoutTemplate([pull, push, legs], [], 'user-1')?.id).toBe(pull.id);
    expect(getNextWorkoutTemplate([pull], [], 'other-user')).toBeNull();
  });
});
