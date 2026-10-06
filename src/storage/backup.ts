import { exerciseDb } from '../data/exercises';
import { WorkoutExerciseState } from '../types';
import { isValidWorkoutDate } from '../domain/history';
import {
  currentTrainingStorageVersion,
  normalizeTrainingState,
  parsePreviousTrainingStorageEnvelope,
  parseTrainingStorageEnvelope,
  TrainingState,
  hasCompleteTrainingRecords,
} from './trainingStorage';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertUnique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length || ids.some((id) => !id.trim())) {
    throw new Error(`${label}: duplicitné alebo prázdne ID.`);
  }
}

function validateEntries(source: unknown, entries: WorkoutExerciseState[]) {
  if (!Array.isArray(source) || source.length !== entries.length) throw new Error('Neplatné cviky v zálohe.');
  assertUnique(entries.map((entry) => entry.id), 'Cviky');
  assertUnique(entries.flatMap((entry) => entry.sets.map((set) => set.id)), 'Série');
  entries.forEach((entry, index) => {
    const original: unknown = source[index];
    if (!record(original) || !Array.isArray(original.sets) || original.sets.length !== entry.sets.length) {
      throw new Error('Neplatné série v zálohe.');
    }
    entry.sets.forEach((set) => {
      if (set.reps < 0 || !Number.isInteger(set.reps) || set.weightKg < 0 ||
          (set.repRangeMin !== undefined && set.repRangeMax !== undefined && set.repRangeMin > set.repRangeMax)) {
        throw new Error('Neplatné hodnoty série.');
      }
    });
  });
}

/** Imports are strict: a malformed backup must never silently erase part of the current history. */
export function parseTrainingBackup(raw: string): TrainingState {
  if (raw.length > 20_000_000) throw new Error('Záloha je príliš veľká (maximum 20 MB).');
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { throw new Error('Súbor nie je platný JSON.'); }
  if (!record(parsed)) throw new Error('Neplatný formát zálohy.');
  const versioned = 'version' in parsed;
  const source = versioned ? parsed.data : parsed;
  const state = versioned
    ? parsed.version === currentTrainingStorageVersion
      ? parseTrainingStorageEnvelope(raw)
      : parsePreviousTrainingStorageEnvelope(raw)
    : normalizeTrainingState(parsed);
  if (!state || !record(source) || !hasCompleteTrainingRecords(source, state)) throw new Error('Nepodporovaná verzia alebo poškodená záloha.');
  const arrays = ['logs', 'customExercises', 'templates', 'machineMemories'] as const;
  for (const key of arrays) {
    const original = source[key];
    if (original !== undefined && (!Array.isArray(original) || original.length !== (state[key]?.length ?? 0))) {
      throw new Error(`Záloha obsahuje neplatné dáta: ${key}.`);
    }
  }
  if (!record(source.schedule) || Object.keys(source.schedule).length !== Object.keys(state.schedule).length) {
    throw new Error('Záloha obsahuje neplatný rozvrh.');
  }
  assertUnique(state.logs.map((log) => log.id), 'Tréningy');
  assertUnique(state.templates.map((template) => template.id), 'Plány');
  assertUnique(state.customExercises.map((exercise) => exercise.id), 'Vlastné cviky');
  assertUnique([...exerciseDb, ...state.customExercises].map((exercise) => exercise.id), 'Katalóg cvikov');
  assertUnique((state.machineMemories ?? []).map((memory) => memory.id), 'Stroje');
  const knownExercises = new Set([...exerciseDb, ...state.customExercises].map((exercise) => exercise.id));
  const entries: WorkoutExerciseState[] = [];
  state.logs.forEach((log, index) => {
    const original: unknown = Array.isArray(source.logs) ? source.logs[index] : undefined;
    validateEntries(record(original) ? original.entries : undefined, log.entries);
    if (!isValidWorkoutDate(log.date) || log.finishedAt < log.startedAt || log.durationSeconds < 0) {
      throw new Error('Neplatný dátum alebo čas tréningu.');
    }
    entries.push(...log.entries);
  });
  if (source.activeWorkout !== null && source.activeWorkout !== undefined) {
    if (!state.activeWorkout || !record(source.activeWorkout)) throw new Error('Poškodený rozbehnutý tréning.');
    validateEntries(source.activeWorkout.entries, state.activeWorkout.entries);
    entries.push(...state.activeWorkout.entries);
  }
  for (const template of state.templates) {
    assertUnique(template.exercises.map((exercise) => exercise.id), 'Cviky v pláne');
    for (const exercise of template.exercises) {
      if (!knownExercises.has(exercise.exerciseId) || (exercise.targetSets ?? 3) < 1 ||
          !Number.isInteger(exercise.targetSets ?? 3) || (exercise.restSeconds ?? 90) < 0 ||
          (exercise.repRangeMin ?? 1) > (exercise.repRangeMax ?? 100) || (exercise.targetRir ?? 0) > 10) throw new Error('Neplatný cvik v pláne.');
    }
  }
  if (entries.some((entry) => !knownExercises.has(entry.exerciseId)) ||
      (state.machineMemories ?? []).some((memory) => !knownExercises.has(memory.exerciseId))) {
    throw new Error('Záloha odkazuje na chýbajúci cvik.');
  }
  const memoryIds = new Set((state.machineMemories ?? []).map((memory) => memory.id));
  if (entries.some((entry) => entry.machineMemoryId && !memoryIds.has(entry.machineMemoryId))) {
    throw new Error('Záloha odkazuje na chýbajúci stroj.');
  }
  if (entries.some((entry) => entry.machineMemoryId && state.machineMemories?.find((memory) => memory.id === entry.machineMemoryId)?.exerciseId !== entry.exerciseId)) {
    throw new Error('Stroj v zálohe patrí inému cviku.');
  }
  if (Object.values(state.schedule).some((day) => !isValidWorkoutDate(day.date) || day.exercises.some((item) => !knownExercises.has(item.exerciseId)))) {
    throw new Error('Rozvrh v zálohe odkazuje na chýbajúci cvik alebo neplatný dátum.');
  }
  return state;
}

export function serializeTrainingBackup(state: TrainingState, now = Date.now()): string {
  return JSON.stringify({ format: 'jimrat-backup', version: currentTrainingStorageVersion, savedAt: now, data: state }, null, 2);
}
