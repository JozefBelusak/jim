import { describe, expect, it, vi } from 'vitest';

import { createTrainingRepository, KeyValueStorage } from './trainingRepository';
import { serializeTrainingState, TrainingState } from './trainingStorage';

function emptyState(): TrainingState {
  return { schedule: {}, logs: [], activeWorkout: null, customExercises: [], templates: [] };
}

describe('training repository', () => {
  it.each(['v6', 'v5', 'v1'])('rejects an empty %s value instead of treating it as missing data', async (version) => {
    const storage: KeyValueStorage = {
      getItem: vi.fn(async (key) => key.endsWith(`.${version}`) ? '' : null),
      setItem: vi.fn(async () => undefined),
    };
    await expect(createTrainingRepository(storage).load()).rejects.toThrow('poškodené');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to legacy data when current data is missing', async () => {
    const legacy = JSON.stringify(emptyState());
    const storage: KeyValueStorage = {
      getItem: vi.fn(async (key) => (key.endsWith('.v1') ? legacy : null)),
      setItem: vi.fn(async () => undefined),
    };

    await expect(createTrainingRepository(storage).load()).resolves.toEqual(emptyState());
  });

  it('prefers valid current data over legacy data', async () => {
    const current = { ...emptyState(), logs: [] };
    const storage: KeyValueStorage = {
      getItem: vi.fn(async (key) =>
        key.endsWith('.v6') ? serializeTrainingState(current, 1) : JSON.stringify({ broken: true }),
      ),
      setItem: vi.fn(async () => undefined),
    };

    const repository = createTrainingRepository(storage);

    await expect(repository.load()).resolves.toEqual(current);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('loads and migrates the previous v2 envelope before trying v1', async () => {
    const previousState = { schedule: {}, logs: [], activeWorkout: null };
    const storage: KeyValueStorage = {
      getItem: vi.fn(async (key) => {
        if (key.endsWith('.v2')) {
          return JSON.stringify({ version: 2, savedAt: 1, data: previousState });
        }
        return key.endsWith('.v1') ? JSON.stringify({ broken: true }) : null;
      }),
      setItem: vi.fn(async () => undefined),
    };

    await expect(createTrainingRepository(storage).load()).resolves.toEqual({
      ...previousState,
      customExercises: [],
      templates: [],
    });
    expect(storage.getItem).toHaveBeenCalledTimes(5);
  });

  it('fails closed when current data is damaged instead of overwriting it with legacy data', async () => {
    const legacy = JSON.stringify(emptyState());
    const storage: KeyValueStorage = {
      getItem: vi.fn(async (key) =>
        key.endsWith('.v6')
          ? JSON.stringify({ version: 6, savedAt: 1, data: { broken: true } })
          : key.endsWith('.v1')
            ? legacy
            : null,
      ),
      setItem: vi.fn(async () => undefined),
    };

    await expect(createTrainingRepository(storage).load()).rejects.toThrow('poškodené');
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('does not overwrite unrecoverable data with an empty state', async () => {
    const storage: KeyValueStorage = { getItem: vi.fn(async () => '{broken'), setItem: vi.fn(async () => undefined) };
    await expect(createTrainingRepository(storage).load()).rejects.toThrow('poškodené');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('migrates v5 without modifying the old storage key', async () => {
    const data = { ...emptyState(), machineMemories: [] };
    const oldRaw = JSON.stringify({ version: 5, savedAt: 1, data });
    const storage: KeyValueStorage = { getItem: vi.fn(async (key) => key.endsWith('.v5') ? oldRaw : null), setItem: vi.fn(async () => undefined) };
    const repository = createTrainingRepository(storage);
    await expect(repository.load()).resolves.toEqual(data);
    await repository.save(data);
    expect(storage.setItem).toHaveBeenCalledWith('jimappka.training.v6', expect.any(String));
  });

  it('serializes saves so an older write cannot finish after a newer write', async () => {
    const releases: (() => void)[] = [];
    const setItem = vi.fn<KeyValueStorage['setItem']>(
      (_key, _value) => new Promise<void>((resolve) => releases.push(resolve)),
    );
    const storage: KeyValueStorage = {
      getItem: vi.fn(async () => null),
      setItem,
    };
    const repository = createTrainingRepository(storage);

    const firstSave = repository.save(emptyState());
    const secondSave = repository.save({
      ...emptyState(),
      schedule: {
        marker: {
          id: 'marker',
          date: '2026-08-14',
          label: 'Marker',
          focus: 'Test',
          exercises: [],
        },
      },
    });

    await vi.waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
    releases[0]();
    await firstSave;
    await vi.waitFor(() => expect(setItem).toHaveBeenCalledTimes(2));
    releases[1]();
    await secondSave;

    const firstPayload = setItem.mock.calls[0][1];
    const secondPayload = setItem.mock.calls[1][1];
    expect(firstPayload).not.toContain('marker');
    expect(secondPayload).toContain('marker');
  });

  it('continues the queue after a failed save', async () => {
    const setItem = vi
      .fn<KeyValueStorage['setItem']>()
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce(undefined);
    const repository = createTrainingRepository({
      getItem: vi.fn(async () => null),
      setItem,
    });

    await expect(repository.save(emptyState())).rejects.toThrow('disk full');
    await expect(repository.save(emptyState())).resolves.toBeUndefined();
    expect(setItem).toHaveBeenCalledTimes(2);
  });
  it('refuses partially damaged prior-version data rather than falling back and writing a truncated migration', async () => {
    const raw = JSON.stringify({ version: 5, savedAt: 1, data: { ...emptyState(), logs: [{ id: 'nested-invalid', dayId: 'day', date: '2026-10-06', volumeKg: 10, durationSeconds: 60, entries: [{ exerciseId: 'bench-press', sets: [{ id: 'set', targetReps: 10, reps: 'corrupt', weightKg: 10, done: true }] }] }] } });
    const storage: KeyValueStorage = { getItem: vi.fn(async (key) => key.endsWith('.v5') ? raw : key.endsWith('.v1') ? JSON.stringify(emptyState()) : null), setItem: vi.fn(async () => undefined) };
    await expect(createTrainingRepository(storage).load()).rejects.toThrow('poškodené');
    expect(storage.getItem).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
