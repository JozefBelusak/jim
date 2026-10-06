import { describe, expect, it } from 'vitest';
import { parseTrainingBackup, serializeTrainingBackup } from './backup';
import { parsePreviousTrainingStorageEnvelope, parseTrainingStorageEnvelope, serializeTrainingState, TrainingState } from './trainingStorage';

function fixture(): TrainingState {
  const entry = { id: 'entry-1', exerciseId: 'bench-press', metric: 'weight_reps' as const, machineMemoryId: 'machine-1',
    sets: [{ id: 'set-1', workoutExerciseId: 'entry-1', type: 'normal' as const, targetReps: 12,
      repRangeMin: 8, repRangeMax: 12, targetRir: 2, rir: 2, rpe: 8, reps: 10, weightKg: 60,
      done: true, createdAt: 1000, completedAt: 2000 }] };
  return { schedule: {}, logs: [{ id: 'log-1', userId: 'local-user', dayId: '2026-10-06', date: '2026-10-06',
    name: 'Push', notes: 'Test', startedAt: 1000, finishedAt: 61000, durationSeconds: 60, volumeKg: 600, entries: [entry] }],
    activeWorkout: { id: 'active', userId: 'local-user', dayId: '2026-10-06', name: 'Empty', startedAt: 3000,
      phase: 'set', exerciseIndex: 0, setIndex: 0, restTargetSeconds: 90, pausedAt: 4000, pausedDurationMs: 100, deadlineAt: 9000, entries: [] },
    customExercises: [], templates: [{ id: 'template-1', userId: 'local-user', name: 'Push', exercises: [{ id: 'template-entry', exerciseId: 'bench-press', order: 0, targetSets: 3, repRangeMin: 8, repRangeMax: 12, targetRir: 2 }], createdAt: 1, updatedAt: 2, archived: true }],
    machineMemories: [{ id: 'machine-1', exerciseId: 'bench-press', gymName: 'Gym', machineName: 'Bench 1', settings: 'Seat 4', lastUsedAt: 2000 }], onboardingCompleted: true };
}

describe('complete JSON backup and v6 migration', () => {
  it('round-trips every collection, active timing, efforts, rep ranges and machine memory', () => {
    const original = fixture();
    expect(parseTrainingBackup(serializeTrainingBackup(original, 9000))).toEqual(original);
    expect(parseTrainingStorageEnvelope(serializeTrainingState(original, 9000))).toEqual(original);
  });
  it('imports v5, preserving the old workout fields without deleting records', () => {
    const original = fixture();
    const raw = JSON.stringify({ version: 5, savedAt: 9000, data: original });
    expect(parsePreviousTrainingStorageEnvelope(raw)).toEqual(original);
    expect(parseTrainingBackup(raw)).toEqual(original);
  });
  it('imports an old version with missing newer collections', () => {
    const raw = JSON.stringify({ version: 2, savedAt: 1, data: { schedule: {}, logs: [], activeWorkout: null } });
    expect(parseTrainingBackup(raw)).toEqual({ schedule: {}, logs: [], activeWorkout: null, customExercises: [], templates: [] });
  });
  it('rejects future versions, invalid JSON and oversized files', () => {
    expect(() => parseTrainingBackup('{')).toThrow();
    expect(() => parseTrainingBackup(JSON.stringify({ version: 99, savedAt: 1, data: fixture() }))).toThrow();
    expect(() => parseTrainingBackup(' '.repeat(20_000_001))).toThrow('20 MB');
  });
  it('rejects malformed nested records instead of silently losing part of a backup', () => {
    const original = fixture();
    const source = JSON.parse(serializeTrainingBackup(original)) as { data: { logs: unknown[] } };
    source.data.logs.push({ id: 'broken' });
    expect(() => parseTrainingBackup(JSON.stringify(source))).toThrow();
  });
  it('rejects duplicate log identities and missing exercise/machine references', () => {
    const original = fixture();
    expect(() => parseTrainingBackup(serializeTrainingBackup({ ...original, logs: [...original.logs, original.logs[0]] }))).toThrow(/duplicitné|poškodená/);
    expect(() => parseTrainingBackup(serializeTrainingBackup({ ...original, machineMemories: [] }))).toThrow('stroj');
    const invalid = { ...original, logs: [{ ...original.logs[0], entries: [{ ...original.logs[0].entries[0], exerciseId: 'missing' }] }] };
    expect(() => parseTrainingBackup(serializeTrainingBackup(invalid))).toThrow('cvik');
  });
  it('preserves all five metric snapshots and active superset rest destinations', () => {
    const original = fixture();
    const metrics = ['weight_reps', 'reps', 'duration', 'distance_duration', 'assisted_reps'] as const;
    const state = { ...original, activeWorkout: original.activeWorkout ? { ...original.activeWorkout,
      phase: 'rest' as const, restNextExerciseId: 'entry-1', restNextSetId: 'set-1',
      entries: original.logs[0].entries } : null };
    for (const metric of metrics) {
      state.logs = [{ ...original.logs[0], entries: [{ ...original.logs[0].entries[0], metric,
        sets: [{ ...original.logs[0].entries[0].sets[0], durationSeconds: 120, distanceKm: 0.5 }] }] }];
      expect(parseTrainingBackup(serializeTrainingBackup(state)).logs[0].entries[0]).toEqual(state.logs[0].entries[0]);
    }
    expect(parseTrainingBackup(serializeTrainingBackup(state)).activeWorkout?.restNextSetId).toBe('set-1');
  });
  it('rejects impossible calendar dates, unsafe media and mismatched machine references', () => {
    const state = fixture();
    expect(() => parseTrainingBackup(serializeTrainingBackup({ ...state, logs: [{ ...state.logs[0], date: '2026-02-30' }] }))).toThrow('dátum');
    expect(() => parseTrainingBackup(serializeTrainingBackup({ ...state, machineMemories: [{ ...state.machineMemories![0], exerciseId: 'leg-press' }] }))).toThrow('inému cviku');
    const custom = { id: 'custom', name: 'Custom', primaryMuscle: 'chest' as const, secondaryMuscles: [], equipment: 'machine' as const, category: 'compound' as const, movementType: 'push' as const, weightMode: 'external' as const, isCustom: true, createdBy: 'local-user', videoUrl: 'javascript:alert(1)' };
    expect(() => parseTrainingBackup(serializeTrainingBackup({ ...state, customExercises: [custom] }))).toThrow();
  });
  it('rejects partially corrupted current storage and migrates assisted history without false load volume', () => {
    const state = fixture();
    const raw = JSON.parse(serializeTrainingState(state)) as { data: { logs: unknown[] } };
    raw.data.logs.push({ id: 'damaged' });
    expect(parseTrainingStorageEnvelope(JSON.stringify(raw))).toBeNull();
    const entry = { ...state.logs[0].entries[0], exerciseId: 'assisted-pull-up', metric: undefined, machineMemoryId: undefined };
    const migrated = parsePreviousTrainingStorageEnvelope(JSON.stringify({ version: 5, savedAt: 1, data: { ...state, logs: [{ ...state.logs[0], entries: [entry] }] } }));
    expect(migrated?.logs[0].entries[0].metric).toBe('assisted_reps');
    expect(migrated?.logs[0].volumeKg).toBe(0);
    expect(migrated?.logs[0].entries[0].sets[0].weightKg).toBe(60);
  });
});
