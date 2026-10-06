import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDateLabel } from '../data/plans';
import { buildExerciseProgress } from '../domain/progress';
import { styles } from '../theme/styles';
import { Exercise, ProgressTimeframe, WorkoutLog } from '../types';

type ExerciseProgressPanelProps = {
  exercise: Exercise;
  logs: WorkoutLog[];
  userId: string;
  now?: number;
};

const timeframeOptions: { value: ProgressTimeframe; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

export function ExerciseProgressPanel({
  exercise,
  logs,
  userId,
  now = Date.now(),
}: ExerciseProgressPanelProps) {
  const [timeframe, setTimeframe] = useState<ProgressTimeframe>('3m');
  const progress = useMemo(
    () => buildExerciseProgress(logs, userId, exercise.id, timeframe, now),
    [exercise.id, logs, now, timeframe, userId],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={styles.exerciseDetailTitle}>
          <Text style={styles.eyebrow}>Exercise progress</Text>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
        </View>
        <Text style={styles.rowValue}>{progress.points.length} sessions</Text>
      </View>

      <View style={styles.chipRow}>
        {timeframeOptions.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, timeframe === option.value ? styles.chipActive : null]}
            onPress={() => setTimeframe(option.value)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {progress.lastPerformance ? (
        <>
          <View style={styles.quickStats}>
            <ProgressMetric label="Best weight" value={`${formatNumber(progress.bestWeightKg)} kg`} />
            <ProgressMetric label="Est. 1RM" value={`${formatNumber(progress.bestEstimated1RmKg)} kg`} />
            <ProgressMetric label="Frequency" value={`${progress.sessionsPerWeek.toFixed(1)}/wk`} />
          </View>

          <View style={styles.card}>
            <Text style={styles.descriptionLabel}>Last workout</Text>
            <Text style={styles.rowTitle}>{formatDateLabel(progress.lastPerformance.date)}</Text>
            <View style={styles.metaPillRow}>
              {progress.lastPerformance.workingSets.map((set, index) => (
                <View key={set.id} style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {index + 1}. {set.weightKg} kg × {set.reps}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <TrendChart
            title="Maximum weight"
            values={progress.points.map((point) => point.maxWeightKg)}
            unit="kg"
            tone="pink"
          />
          <TrendChart
            title="Estimated 1RM"
            values={progress.points.map((point) => point.estimated1RmKg)}
            unit="kg"
            tone="yellow"
          />
          <TrendChart
            title="Exercise volume"
            values={progress.points.map((point) => point.volumeKg)}
            unit="kg"
            tone="mint"
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Exercise history</Text>
            <View style={styles.progressHistoryList}>
              {[...progress.points].reverse().map((point) => (
                <View key={point.logId} style={styles.progressHistoryRow}>
                  <View style={styles.exerciseDetailTitle}>
                    <Text style={styles.rowTitle}>{formatDateLabel(point.date)}</Text>
                    <Text style={styles.rowMuted}>{point.workingSets.length} working sets</Text>
                  </View>
                  <View>
                    <Text style={styles.rowValue}>{formatNumber(point.maxWeightKg)} kg max</Text>
                    <Text style={styles.rowMuted}>{formatNumber(point.volumeKg)} kg volume</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.compactText}>
            No completed working sets for this exercise in the selected timeframe.
          </Text>
        </View>
      )}
    </View>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TrendChart({
  title,
  values,
  unit,
  tone,
}: {
  title: string;
  values: number[];
  unit: string;
  tone: 'pink' | 'mint' | 'yellow';
}) {
  const visibleValues = values.slice(-12);
  const maximum = Math.max(...visibleValues, 0);
  const latest = visibleValues.at(-1) ?? 0;

  return (
    <View style={styles.progressChartCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.descriptionLabel}>{title}</Text>
        <Text style={styles.rowValue}>{formatNumber(latest)} {unit}</Text>
      </View>
      <View style={styles.progressBars}>
        {visibleValues.map((value, index) => (
          <View key={`${index}-${value}`} style={styles.progressBarColumn}>
            <View
              style={[
                styles.progressBar,
                tone === 'pink'
                  ? styles.progressBarPink
                  : tone === 'mint'
                    ? styles.progressBarMint
                    : styles.progressBarYellow,
                { height: maximum > 0 ? Math.max(4, value / maximum * 92) : 4 },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.rowMuted}>Older</Text>
        <Text style={styles.rowMuted}>Latest · last {visibleValues.length}</Text>
      </View>
    </View>
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
