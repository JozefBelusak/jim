import { describe, expect, it } from 'vitest';
import { exerciseDb } from './exercises';
import { createStarterTemplates } from './starterTemplates';

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
});
