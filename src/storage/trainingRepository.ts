import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseLegacyTrainingStorage,
  parsePreviousTrainingStorageEnvelope,
  parseTrainingStorageEnvelope,
  serializeTrainingState,
  TrainingState,
  hasCompleteTrainingRecords,
  currentTrainingStorageVersion,
  previousTrainingStorageVersions,
} from './trainingStorage';

export const currentStorageKey = `jimappka.training.v${currentTrainingStorageVersion}`;
const previousStorageKeys = previousTrainingStorageVersions.map((version) => `jimappka.training.v${version}`);
const legacyStorageKey = 'jimappka.training.v1';

export function flushTrainingState(state: TrainingState) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(currentStorageKey, serializeTrainingState(state));
  }
}

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createTrainingRepository(storage: KeyValueStorage) {
  let saveQueue: Promise<void> = Promise.resolve();

  return {
    async load(): Promise<TrainingState | null> {
      const currentRaw = await storage.getItem(currentStorageKey);
      if (currentRaw !== null) {
        const current = parseTrainingStorageEnvelope(currentRaw);
        if (current) {
          return current;
        }
        throw new Error('Uložené dáta sú poškodené. Importuj zálohu; pôvodné dáta zostali zachované.');
      }

      for (const previousStorageKey of previousStorageKeys) {
        const previousRaw = await storage.getItem(previousStorageKey);
        if (previousRaw !== null) {
          const previous = parsePreviousTrainingStorageEnvelope(previousRaw);
          let original: unknown;
          try { original = JSON.parse(previousRaw) as unknown; } catch { original = null; }
          const data = typeof original === 'object' && original !== null && 'data' in original ? original.data : undefined;
          if (previous && hasCompleteTrainingRecords(data, previous)) {
            return previous;
          }
          throw new Error('Staršie uložené dáta sú poškodené. Pôvodné dáta zostali zachované.');
        }
      }

      const legacyRaw = await storage.getItem(legacyStorageKey);
      const legacy = legacyRaw !== null ? parseLegacyTrainingStorage(legacyRaw) : null;
      if (legacy && legacyRaw !== null && hasCompleteTrainingRecords(JSON.parse(legacyRaw) as unknown, legacy)) return legacy;
      if (legacyRaw !== null) throw new Error('Uložené dáta sú poškodené. Importuj zálohu; pôvodné dáta zostali zachované.');
      return null;
    },

    save(state: TrainingState): Promise<void> {
      const serialized = serializeTrainingState(state);
      const queuedSave = saveQueue
        .catch(() => undefined)
        .then(() => storage.setItem(currentStorageKey, serialized));

      saveQueue = queuedSave;
      return queuedSave;
    },
  };
}

export const trainingRepository = createTrainingRepository(AsyncStorage);
