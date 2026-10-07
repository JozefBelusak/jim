import { describe, expect, it } from 'vitest';
import { exerciseDb } from './exercises';
import { addStarterTemplate, createStarterTemplates, findStarterTemplate, identifyStarterTemplate } from './starterTemplates';
import { duplicateWorkoutTemplate } from '../domain/templates';
import { parseTrainingBackup, serializeTrainingBackup } from '../storage/backup';

describe('starter workout templates', () => {
  it('creates usable plans with known exercises, valid ranges and independent identities', () => {
    let identity = 0;
    const templates = createStarterTemplates('local-user', 100, () => `id-${identity++}`);
    expect(templates).toHaveLength(4);
    const ids = templates.flatMap((template) => [template.id, ...template.exercises.map((entry) => entry.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    templates.forEach((template) => {
      expect(template.userId).toBe('local-user');
      expect(template.createdAt).toBe(100);
      expect(template.exercises.length).toBeGreaterThan(0);
      template.exercises.forEach((entry) => {
        expect(exerciseDb.some((exercise) => exercise.id === entry.exerciseId)).toBe(true);
        expect(entry.repRangeMin).toBeLessThanOrEqual(entry.repRangeMax!);
      });
    });
    expect(templates[0].exercises.find((entry) => entry.exerciseId === 'plank')).toMatchObject({ repRangeMin: 20, repRangeMax: 40 });
  });

  it('adds one selected plan and reuses it after renaming and repeated additions', () => {
    let identity = 0;
    const createId = () => `id-${identity++}`;
    const first = addStarterTemplate([], 'local-user', 1, 100, createId);
    expect(first.templates).toHaveLength(1);
    expect(first.template.name).toBe('Upper body');
    const renamed = { ...first.template, name: 'My push and pull', exercises: first.template.exercises.slice(0, 2) };
    const again = addStarterTemplate([renamed], 'local-user', 1, 200, createId);
    expect(again.templates).toHaveLength(1);
    expect(again.template).toMatchObject({ id: first.template.id, name: renamed.name });
    expect(again.template.exercises).toEqual(renamed.exercises);
    const backedUp = parseTrainingBackup(serializeTrainingBackup({ schedule: {}, logs: [], activeWorkout: null, templates: again.templates, customExercises: [] }));
    expect(findStarterTemplate(backedUp.templates, 'local-user', 1)?.id).toBe(first.template.id);
  });

  it('restores an archived starter without replacing its targets or identity', () => {
    const first = addStarterTemplate([], 'local-user', 0, 100, () => 'identity');
    const archived = { ...first.template, archived: true, exercises: [{ ...first.template.exercises[0], targetSets: 5 }] };
    const restored = addStarterTemplate([archived], 'local-user', 0, 200, () => { throw new Error('No new identities expected'); });
    expect(restored.templates).toHaveLength(1);
    expect(restored.template).toMatchObject({ id: archived.id, archived: false, updatedAt: 200 });
    expect(restored.template.exercises[0].targetSets).toBe(5);
  });

  it('recognizes previous starter plans without keys and leaves unrelated custom plans alone', () => {
    let identity = 0;
    const createId = () => `id-${identity++}`;
    const original = createStarterTemplates('local-user', 100, createId)[0];
    const previous = { ...original, starterKey: undefined };
    const reused = addStarterTemplate([previous], 'local-user', 0, 200, createId);
    expect(reused.templates).toHaveLength(1);
    expect(reused.template.id).toBe(previous.id);
    expect(reused.template.starterKey).toBe('full-body-machines');
    const custom = { ...previous, exercises: [] };
    expect(addStarterTemplate([custom], 'local-user', 0, 200, createId).templates).toHaveLength(2);
    expect(findStarterTemplate([original], 'another-user', 0)).toBeUndefined();
  });

  it('does not mark an intentional duplicate as the original starter', () => {
    let identity = 0;
    const template = createStarterTemplates('local-user', 100, () => `id-${identity++}`)[0];
    const copy = duplicateWorkoutTemplate(template, { id: 'copy', userId: 'local-user', createdAt: 200, templateExerciseIds: template.exercises.map((_entry, index) => `copy-entry-${index}`) });
    expect(copy.starterKey).toBeUndefined();
    expect(findStarterTemplate([copy], 'local-user', 0)).toBeUndefined();
  });

  it('retains a legacy starter identity before its first rename or exercise edit', () => {
    let identity = 0;
    const original = createStarterTemplates('local-user', 100, () => `id-${identity++}`)[1];
    const previous = { ...original, starterKey: undefined };
    const identified = identifyStarterTemplate(previous);
    const edited = { ...identified, name: 'My routine', exercises: identified.exercises.slice(0, 1) };
    expect(findStarterTemplate([edited], 'local-user', 1)?.id).toBe(previous.id);
    expect(identifyStarterTemplate({ ...previous, name: 'Unrelated custom routine' }).starterKey).toBeUndefined();
  });
});
