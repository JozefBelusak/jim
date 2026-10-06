import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseLegacyTrainingStorage,
  parsePreviousTrainingStorageEnvelope,
  parseTrainingStorageEnvelope,
  serializeTrainingState,
  TrainingState,
} from './trainingStorage';

const currentStorageKey = 'jimappka.training.v5';
const previousStorageKeys = [
  'jimappka.training.v4',
  'jimappka.training.v3',
  'jimappka.training.v2',
];
const legacyStorageKey = 'jimappka.training.v1';

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function createTrainingRepository(storage: KeyValueStorage) {
  let saveQueue: Promise<void> = Promise.resolve();

  return {
    async load(): Promise<TrainingState | null> {
      const currentRaw = await storage.getItem(currentStorageKey);
      if (currentRaw) {
        const current = parseTrainingStorageEnvelope(currentRaw);
        if (current) {
          return current;
        }
      }

      for (const previousStorageKey of previousStorageKeys) {
        const previousRaw = await storage.getItem(previousStorageKey);
        if (previousRaw) {
          const previous = parsePreviousTrainingStorageEnvelope(previousRaw);
          if (previous) {
            return previous;
          }
        }
      }

      const legacyRaw = await storage.getItem(legacyStorageKey);
      return legacyRaw ? parseLegacyTrainingStorage(legacyRaw) : null;
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
