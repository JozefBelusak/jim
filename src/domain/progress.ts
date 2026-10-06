import {
  ExerciseProgress,
  ExerciseProgressPoint,
  PersonalRecord,
  ProgressTimeframe,
  WorkoutExerciseState,
  WorkoutLog,
  WorkoutSet,
} from '../types';

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const timeframeDays: Record<Exclude<ProgressTimeframe, 'all'>, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

export function calculateEstimated1Rm(weightKg: number, reps: number) {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }

  return weightKg * (1 + reps / 30);
}

export function calculatePersonalRecords(
  currentEntries: WorkoutExerciseState[],
  previousLogs: WorkoutLog[],
  userId: string,
): PersonalRecord[] {
  return currentEntries.flatMap((entry) => {
    const currentSets = getWorkingSets(entry.sets);
    if (currentSets.length === 0) {
      return [];
    }

    const previousExerciseEntries = previousLogs
      .filter((log) => log.userId === userId)
      .flatMap((log) => log.entries.filter((item) => item.exerciseId === entry.exerciseId));
    const previousSets = previousExerciseEntries.flatMap((item) => getWorkingSets(item.sets));
    const records: PersonalRecord[] = [];

    const highestWeightSet = maxSetBy(currentSets, (set) => set.weightKg);
    const previousHighestWeight = maxValue(previousSets, (set) => set.weightKg);
    if (highestWeightSet && highestWeightSet.weightKg > previousHighestWeight) {
      records.push(createSetRecord(
        'highest_weight',
        entry.exerciseId,
        highestWeightSet,
        highestWeightSet.weightKg,
        previousHighestWeight,
      ));
    }

    const repsRecord = findBestRepsAtWeightRecord(currentSets, previousSets);
    if (repsRecord) {
      records.push({
        type: 'reps_at_weight',
        exerciseId: entry.exerciseId,
        setId: repsRecord.set.id,
        value: repsRecord.set.reps,
        previousValue: repsRecord.previousReps,
        weightKg: repsRecord.set.weightKg,
        reps: repsRecord.set.reps,
      });
    }

    const estimated1RmSet = maxSetBy(currentSets, (set) =>
      calculateEstimated1Rm(set.weightKg, set.reps),
    );
    const estimated1Rm = estimated1RmSet
      ? calculateEstimated1Rm(estimated1RmSet.weightKg, estimated1RmSet.reps)
      : 0;
    const previousEstimated1Rm = maxValue(previousSets, (set) =>
      calculateEstimated1Rm(set.weightKg, set.reps),
    );
    if (estimated1RmSet && estimated1Rm > previousEstimated1Rm) {
      records.push(createSetRecord(
        'estimated_1rm',
        entry.exerciseId,
        estimated1RmSet,
        estimated1Rm,
        previousEstimated1Rm,
      ));
    }

    const highestVolumeSet = maxSetBy(currentSets, calculateSetVolume);
    const highestSetVolume = highestVolumeSet ? calculateSetVolume(highestVolumeSet) : 0;
    const previousHighestSetVolume = maxValue(previousSets, calculateSetVolume);
    if (highestVolumeSet && highestSetVolume > previousHighestSetVolume) {
      records.push(createSetRecord(
        'set_volume',
        entry.exerciseId,
        highestVolumeSet,
        highestSetVolume,
        previousHighestSetVolume,
      ));
    }

    const sessionVolume = currentSets.reduce((sum, set) => sum + calculateSetVolume(set), 0);
    const previousSessionVolume = previousLogs
      .filter((log) => log.userId === userId)
      .reduce((best, log) => {
        const volume = log.entries
          .filter((item) => item.exerciseId === entry.exerciseId)
          .flatMap((item) => getWorkingSets(item.sets))
          .reduce((sum, set) => sum + calculateSetVolume(set), 0);
        return Math.max(best, volume);
      }, 0);
    if (sessionVolume > previousSessionVolume) {
      records.push({
        type: 'exercise_session_volume',
        exerciseId: entry.exerciseId,
        value: sessionVolume,
        previousValue: previousSessionVolume,
      });
    }

    return records;
  });
}

export function buildExerciseProgress(
  logs: WorkoutLog[],
  userId: string,
  exerciseId: string,
  timeframe: ProgressTimeframe,
  now: number,
): ExerciseProgress {
  const cutoff = timeframe === 'all'
    ? Number.NEGATIVE_INFINITY
    : now - timeframeDays[timeframe] * millisecondsPerDay;
  const points = logs
    .filter((log) => log.userId === userId && log.startedAt >= cutoff && log.startedAt <= now)
    .map((log): ExerciseProgressPoint | null => {
      const workingSets = log.entries
        .filter((entry) => entry.exerciseId === exerciseId)
        .flatMap((entry) => getWorkingSets(entry.sets));

      if (workingSets.length === 0) {
        return null;
      }

      return {
        logId: log.id,
        date: log.date,
        timestamp: log.startedAt,
        maxWeightKg: maxValue(workingSets, (set) => set.weightKg),
        estimated1RmKg: maxValue(workingSets, (set) =>
          calculateEstimated1Rm(set.weightKg, set.reps),
        ),
        volumeKg: workingSets.reduce((sum, set) => sum + calculateSetVolume(set), 0),
        workingSets,
      };
    })
    .filter((point): point is ExerciseProgressPoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
  const windowDays = getFrequencyWindowDays(points, timeframe, now);

  return {
    points,
    lastPerformance: points.at(-1) ?? null,
    bestWeightKg: maxValue(points, (point) => point.maxWeightKg),
    bestEstimated1RmKg: maxValue(points, (point) => point.estimated1RmKg),
    bestSessionVolumeKg: maxValue(points, (point) => point.volumeKg),
    sessionsPerWeek: points.length === 0 ? 0 : points.length / Math.max(1, windowDays / 7),
  };
}

function getWorkingSets(sets: WorkoutSet[]) {
  return sets.filter((set) => set.done && set.type !== 'warmup');
}

function calculateSetVolume(set: WorkoutSet) {
  return set.weightKg * set.reps;
}

function maxValue<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((best, item) => Math.max(best, getValue(item)), 0);
}

function maxSetBy(sets: WorkoutSet[], getValue: (set: WorkoutSet) => number) {
  return sets.reduce<WorkoutSet | null>(
    (best, set) => !best || getValue(set) > getValue(best) ? set : best,
    null,
  );
}

function createSetRecord(
  type: PersonalRecord['type'],
  exerciseId: string,
  set: WorkoutSet,
  value: number,
  previousValue: number,
): PersonalRecord {
  return {
    type,
    exerciseId,
    setId: set.id,
    value,
    previousValue,
    weightKg: set.weightKg,
    reps: set.reps,
  };
}

function findBestRepsAtWeightRecord(currentSets: WorkoutSet[], previousSets: WorkoutSet[]) {
  return currentSets.reduce<{ set: WorkoutSet; previousReps: number } | null>((best, set) => {
    const matchingPreviousSets = previousSets.filter(
      (previousSet) => previousSet.weightKg === set.weightKg,
    );
    const previousReps = maxValue(
      matchingPreviousSets,
      (previousSet) => previousSet.reps,
    );
    if (set.reps <= previousReps) {
      return best;
    }

    const improvement = set.reps - previousReps;
    const bestImprovement = best ? best.set.reps - best.previousReps : -1;
    const bestHasPrevious = best
      ? previousSets.some((previousSet) => previousSet.weightKg === best.set.weightKg)
      : false;
    const hasPrevious = matchingPreviousSets.length > 0;

    if (hasPrevious !== bestHasPrevious) {
      return hasPrevious ? { set, previousReps } : best;
    }

    return improvement > bestImprovement ? { set, previousReps } : best;
  }, null);
}

function getFrequencyWindowDays(
  points: ExerciseProgressPoint[],
  timeframe: ProgressTimeframe,
  now: number,
) {
  if (timeframe !== 'all') {
    return timeframeDays[timeframe];
  }

  const firstTimestamp = points[0]?.timestamp;
  return firstTimestamp === undefined
    ? 7
    : Math.max(7, (now - firstTimestamp) / millisecondsPerDay);
}
