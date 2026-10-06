import { describe, expect, it } from 'vitest';
import { WorkoutLog } from '../types';
import { editWorkoutLog, getHistoryPersonalRecords, isValidWorkoutDate, updateHistorySet } from './history';
import { buildExerciseProgress } from './progress';

function makeLog(id: string, weightKg: number, startedAt: number): WorkoutLog {
  return { id, userId: 'user', dayId: 'day', name: 'Push', date: '2026-10-06', startedAt, finishedAt: startedAt + 600_000, durationSeconds: 600, volumeKg: weightKg * 10,
    entries: [{ id: `${id}-entry`, exerciseId: 'bench-press', metric: 'weight_reps', sets: [{ id: `${id}-set`, workoutExerciseId: `${id}-entry`, type: 'normal', done: true, targetReps: 10, reps: 10, weightKg, createdAt: startedAt, completedAt: startedAt + 60_000 }] }] };
}

describe('history editing', () => {
  it('recalculates volume, PR and graph after correcting a logged weight', () => {
    const start = Date.UTC(2026, 9, 6);
    const previous = makeLog('previous', 50, start - 86_400_000);
    const current = makeLog('current', 500, start);
    const corrected = updateHistorySet(current, 'current-entry', 'current-set', { weightKg: 40 });
    expect(current.volumeKg).toBe(5000);
    expect(corrected.volumeKg).toBe(400);
    expect(getHistoryPersonalRecords(corrected, [previous, corrected])).toEqual([]);
    const progress = buildExerciseProgress([previous, corrected], 'user', 'bench-press', 'all', start + 86_400_000);
    expect(progress.bestWeightKg).toBe(50);
    expect(progress.points.at(-1)?.volumeKg).toBe(400);
  });
  it('date changes update ordering timestamps and the duration updates the finish timestamp', () => {
    const original = makeLog('log', 50, new Date(2026, 9, 6, 14, 15).getTime());
    const edited = editWorkoutLog(original, { date: '2026-10-02', durationSeconds: 123, notes: 'Left early' });
    expect(new Date(edited.startedAt).getDate()).toBe(2);
    expect(new Date(edited.startedAt).getHours()).toBe(14);
    expect(edited.dayId).toBe('2026-10-02');
    expect(edited.finishedAt - edited.startedAt).toBe(123_000);
    expect(edited.notes).toBe('Left early');
  });
  it('recalculates volume after removing or unchecking a set and ignores assisted volume', () => {
    const log = makeLog('log', 50, 1_000);
    expect(updateHistorySet(log, 'log-entry', 'log-set', { done: false }).volumeKg).toBe(0);
    expect(editWorkoutLog(log, { entries: [] }).volumeKg).toBe(0);
    expect(editWorkoutLog(log, { entries: [{ ...log.entries[0], metric: 'assisted_reps' }] }).volumeKg).toBe(0);
  });
  it('rejects impossible dates, invalid inputs and effort/range bounds', () => {
    const log = makeLog('log', 50, 1_000);
    expect(isValidWorkoutDate('2026-02-30')).toBe(false);
    expect(isValidWorkoutDate('2024-02-29')).toBe(true);
    expect(() => editWorkoutLog(log, { date: '2026-02-30' })).toThrow('valid date');
    expect(() => editWorkoutLog(log, { durationSeconds: -1 })).toThrow('duration');
    expect(() => updateHistorySet(log, 'log-entry', 'log-set', { reps: Number.NaN })).toThrow('valid');
    expect(() => updateHistorySet(log, 'log-entry', 'log-set', { rpe: 11 })).toThrow('RPE');
    expect(() => updateHistorySet(log, 'log-entry', 'log-set', { repRangeMin: 12, repRangeMax: 8 })).toThrow('minimum');
  });
  it('uses earlier history only for historical PRs and recomputes later records after edits/deletion', () => {
    const earlier = makeLog('earlier', 60, 1000);
    const later = makeLog('later', 55, 2000);
    expect(getHistoryPersonalRecords(later, [earlier, later])).toEqual([]);
    const corrected = updateHistorySet(earlier, 'earlier-entry', 'earlier-set', { weightKg: 50 });
    expect(getHistoryPersonalRecords(later, [corrected, later]).some((record) => record.type === 'highest_weight')).toBe(true);
    expect(getHistoryPersonalRecords(later, [later]).some((record) => record.type === 'highest_weight')).toBe(true);
  });
});
