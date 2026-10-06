import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDateLabel } from '../data/plans';
import { formatDuration, formatMetricNumber, formatSetPerformance, getExerciseMetric } from '../domain/metrics';
import { buildExerciseProgress, getProgressionRecommendation } from '../domain/progress';
import { colors, styles } from '../theme/styles';
import { Exercise, ExerciseProgressPoint, MachineMemory, ProgressTimeframe, WorkoutLog } from '../types';

type ExerciseProgressPanelProps = {
  exercise: Exercise; logs: WorkoutLog[]; userId: string; now?: number; machineMemoryId?: string; machineMemories?: MachineMemory[];
};
const timeframeOptions: { value: ProgressTimeframe; label: string }[] = [
  { value: '1m', label: '1M' }, { value: '3m', label: '3M' }, { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' }, { value: 'all', label: 'All' },
];

export function ExerciseProgressPanel({ exercise, logs, userId, now = Date.now(), machineMemoryId, machineMemories = [] }: ExerciseProgressPanelProps) {
  const [timeframe, setTimeframe] = useState<ProgressTimeframe>('3m');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [machineSelection, setMachineSelection] = useState<{ exerciseId: string; memoryId?: string }>({ exerciseId: exercise.id, memoryId: machineMemoryId });
  const selectedMachineId = machineSelection.exerciseId === exercise.id ? machineSelection.memoryId : machineMemoryId;
  const exerciseMetric = getExerciseMetric(exercise);
  const availableMachines = machineMemories.filter((memory) => memory.exerciseId === exercise.id);
  const progress = useMemo(() => buildExerciseProgress(logs, userId, exercise.id, timeframe, now, selectedMachineId, exerciseMetric),
    [exercise.id, logs, now, timeframe, userId, selectedMachineId, exerciseMetric]);
  const metric = progress.metric ?? getExerciseMetric(exercise);
  const selected = progress.points.find((point) => point.logId === selectedLogId) ?? progress.lastPerformance;
  const latestEntry = [...logs].filter((log) => log.userId === userId).sort((a, b) => b.startedAt - a.startedAt)
    .flatMap((log) => log.entries).find((entry) => entry.exerciseId === exercise.id && entry.machineMemoryId === selectedMachineId && (entry.metric ?? exerciseMetric) === exerciseMetric);
  const recommendation = latestEntry ? getProgressionRecommendation(latestEntry, logs, userId) : null;
  const bestValue = metric === 'weight_reps' ? `${formatMetricNumber(progress.bestWeightKg)} kg`
    : metric === 'duration' ? formatDuration(progress.longestDurationSeconds ?? 0)
      : metric === 'distance_duration' ? `${formatMetricNumber(progress.longestDistanceKm ?? 0)} km`
        : metric === 'assisted_reps' ? `${formatMetricNumber(progress.minAssistanceKg ?? 0)} kg assist.` : `${progress.bestReps ?? 0} reps`;
  const charts: { title: string; unit: string; value: (point: ExerciseProgressPoint) => number; color: string }[] = metric === 'weight_reps'
    ? [
      { title: 'Maximum weight', unit: 'kg', value: (point) => point.maxWeightKg, color: colors.pink },
      { title: 'Estimated 1RM (Epley)', unit: 'kg', value: (point) => point.estimated1RmKg, color: colors.yellow },
      { title: 'Exercise volume', unit: 'kg', value: (point) => point.volumeKg, color: colors.mint },
    ] : metric === 'duration'
      ? [{ title: 'Longest hold', unit: 's', value: (point) => point.longestDurationSeconds ?? 0, color: colors.mint }]
      : metric === 'distance_duration'
        ? [{ title: 'Longest distance', unit: 'km', value: (point) => point.longestDistanceKm ?? 0, color: colors.mint },
          { title: 'Duration', unit: 's', value: (point) => point.longestDurationSeconds ?? 0, color: colors.yellow }]
        : metric === 'assisted_reps'
          ? [{ title: 'Least assistance (lower is harder)', unit: 'kg', value: (point) => point.minAssistanceKg ?? 0, color: colors.mint },
            { title: 'Most repetitions', unit: 'reps', value: (point) => point.bestReps ?? 0, color: colors.yellow }]
          : [{ title: 'Most repetitions', unit: 'reps', value: (point) => point.bestReps ?? 0, color: colors.mint }];

  return (
    <View style={styles.screen}>
      <View style={styles.rowBetween}>
        <View style={styles.exerciseDetailTitle}><Text style={styles.eyebrow}>Exercise progress</Text><Text style={styles.cardTitle}>{exercise.name}</Text></View>
        <Text style={styles.rowValue}>{progress.points.length} sessions</Text>
      </View>
      <View style={styles.chipRow}>{timeframeOptions.map((option) => <Pressable key={option.value} style={[styles.chip, timeframe === option.value && styles.chipActive]} onPress={() => setTimeframe(option.value)}><Text style={styles.chipText}>{option.label}</Text></Pressable>)}</View>
      {availableMachines.length ? <View style={styles.card}><Text style={styles.descriptionLabel}>Machine-specific history</Text><View style={[styles.chipRow, { marginTop: 10 }]}><Pressable style={[styles.chip, selectedMachineId === undefined && styles.chipActive]} onPress={() => setMachineSelection({ exerciseId: exercise.id })}><Text style={styles.chipText}>Unassigned</Text></Pressable>{availableMachines.map((memory) => <Pressable key={memory.id} style={[styles.chip, selectedMachineId === memory.id && styles.chipActive]} onPress={() => setMachineSelection({ exerciseId: exercise.id, memoryId: memory.id })}><Text style={styles.chipText}>{memory.gymName} · {memory.machineName}</Text></Pressable>)}</View></View> : null}
      {selected ? <>
        <View style={styles.quickStats}><ProgressMetric label={metric === 'assisted_reps' ? 'Least assistance' : 'Best performance'} value={bestValue} /><ProgressMetric label="Frequency" value={`${progress.sessionsPerWeek.toFixed(1)}/wk`} /></View>
        {recommendation ? <View style={styles.card}><Text style={styles.descriptionLabel}>Next session suggestion</Text><Text style={styles.compactText}>{recommendation.message}</Text></View> : null}
        {charts.map((chart) => <TrendChart key={chart.title} {...chart} points={progress.points} selectedLogId={selected.logId} onSelect={setSelectedLogId} />)}
        <View style={styles.card}>
          <Text style={styles.descriptionLabel}>Selected performance</Text><Text style={styles.rowTitle}>{formatDateLabel(selected.date)} · {selected.date}</Text>
          <View style={styles.progressHistoryList}>{selected.workingSets.map((set, index) => <View key={set.id}><Text style={styles.rowValue}>{index + 1}. {formatSetPerformance(set, selected.metric ?? metric)}</Text>{set.note ? <Text style={styles.rowMuted}>{set.note}</Text> : null}</View>)}</View>
        </View>
        <View style={styles.card}><Text style={styles.cardTitle}>Exercise history</Text><Text style={styles.rowMuted}>Tap a date or a chart bar to see every set.</Text>
          <View style={styles.progressHistoryList}>{[...progress.points].reverse().map((point) => <Pressable key={point.logId} style={styles.progressHistoryRow} onPress={() => setSelectedLogId(point.logId)}><View style={styles.exerciseDetailTitle}><Text style={styles.rowTitle}>{formatDateLabel(point.date)} · {point.date.slice(0, 4)}</Text><Text style={styles.rowMuted}>{point.workingSets.length} working sets</Text></View><Text style={[styles.rowValue, selected.logId === point.logId && { color: colors.mint }]}>{formatSetPerformance(point.workingSets[0], point.metric ?? metric)}</Text></Pressable>)}</View>
        </View>
      </> : <View style={styles.card}><Text style={styles.compactText}>No completed working sets in this timeframe.</Text></View>}
    </View>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function TrendChart({ title, points, unit, value, color, selectedLogId, onSelect }: {
  title: string; points: ExerciseProgressPoint[]; unit: string; value: (point: ExerciseProgressPoint) => number;
  color: string; selectedLogId: string; onSelect: (id: string) => void;
}) {
  const visible = points.slice(-6);
  const maximum = Math.max(...visible.map(value), 0);
  return <View style={styles.progressChartCard}>
    <Text style={styles.descriptionLabel}>{title}</Text><Text style={styles.rowMuted}>Axis: 0–{formatMetricNumber(maximum)} {unit} · last {visible.length} sessions</Text>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 16 }}>{visible.map((point) => <Pressable key={point.logId} accessibilityLabel={`${point.date}: ${formatMetricNumber(value(point))} ${unit}. Show sets.`} onPress={() => onSelect(point.logId)} style={{ flex: 1, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: point.logId === selectedLogId ? colors.text : colors.line, paddingBottom: 4 }}>
      <Text style={[styles.rowMuted, { fontSize: 10 }]}>{formatMetricNumber(value(point))}</Text>
      <View style={{ height: 100, width: '85%', justifyContent: 'flex-end' }}><View style={{ height: maximum > 0 ? Math.max(4, value(point) / maximum * 96) : 4, backgroundColor: color, borderRadius: 4 }} /></View>
      <Text style={[styles.rowMuted, { fontSize: 10, marginTop: 5 }]}>{point.date.slice(8)}.{point.date.slice(5, 7)}</Text>
    </Pressable>)}</View>
  </View>;
}
