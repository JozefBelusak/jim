import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatDateLabel, formatTime } from '../data/plans';
import { editWorkoutLog, getHistoryPersonalRecords, WorkoutLogEdit } from '../domain/history';
import { formatSetPerformance, getEntryMetric } from '../domain/metrics';
import { formatPersonalRecord } from '../domain/progress';
import { calculateWorkoutVolume, countCompletedSets } from '../domain/workouts';
import { colors, styles } from '../theme/styles';
import { Exercise, ExerciseMetric, SetType, WorkoutLog, WorkoutSet } from '../types';

export type WorkoutHistoryCallbacks = {
  onUpdateLog?: (log: WorkoutLog) => void;
  onDeleteLog?: (id: string) => void;
  onRepeatLog?: (log: WorkoutLog) => void;
};
type Props = WorkoutHistoryCallbacks & { logs: WorkoutLog[]; allLogs?: WorkoutLog[]; exercises: Exercise[]; initialOpenLogId?: string | null };

export function WorkoutHistoryPanel({ logs, allLogs = logs, exercises, initialOpenLogId, ...callbacks }: Props) {
  return <View style={styles.libraryList}>{[...logs].sort((a, b) => b.startedAt - a.startedAt).map((log) =>
    <HistoryCard key={log.id} log={log} allLogs={allLogs} exercises={exercises} initialOpenLogId={initialOpenLogId} {...callbacks} />)}</View>;
}

function HistoryCard({ log, allLogs, exercises, initialOpenLogId, onUpdateLog, onDeleteLog, onRepeatLog }: WorkoutHistoryCallbacks & { log: WorkoutLog; allLogs: WorkoutLog[]; exercises: Exercise[]; initialOpenLogId?: string | null }) {
  const [open, setOpen] = useState(log.id === initialOpenLogId);
  const [draft, setDraft] = useState<WorkoutLog | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (initialOpenLogId === log.id) setOpen(true); }, [initialOpenLogId, log.id]);
  const displayed = draft ?? log;
  const records = getHistoryPersonalRecords(displayed, allLogs);
  const patch = (edit: WorkoutLogEdit) => setDraft((previous) => previous ? { ...previous, ...edit } : previous);
  const patchSet = (entryId: string, setId: string, edit: Partial<WorkoutSet>) => setDraft((previous) => previous ? {
    ...previous, entries: previous.entries.map((entry) => entry.id !== entryId ? entry : {
      ...entry, sets: entry.sets.map((set) => set.id === setId ? { ...set, ...edit } : set),
    }),
  } : previous);
  const save = () => {
    if (!draft || !onUpdateLog) return;
    try { onUpdateLog(editWorkoutLog(log, draft)); setDraft(null); setError(''); }
    catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Unable to save the workout.'); }
  };
  const addSet = (entryId: string) => setDraft((previous) => previous ? {
    ...previous, entries: previous.entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const now = Date.now();
      const source = entry.sets.at(-1);
      const set: WorkoutSet = {
        ...(source ?? { type: 'normal', targetReps: 10, reps: 10, weightKg: 0 }),
        id: `history-set-${now}-${Math.random().toString(36).slice(2, 8)}`,
        workoutExerciseId: entry.id, createdAt: now, done: true, completedAt: previous.finishedAt, note: '',
      };
      return { ...entry, sets: [...entry.sets, set] };
    }),
  } : previous);

  return <View style={styles.historyLogCard}>
    <Pressable onPress={() => setOpen((value) => !value)} accessibilityLabel={`${open ? 'Close' : 'Open'} ${log.name} details`}>
      <View style={styles.rowBetween}><View style={styles.exerciseDetailTitle}><Text style={styles.rowTitle}>{log.name}</Text><Text style={styles.rowMuted}>{formatDateLabel(log.date)} · {log.date.slice(0, 4)}</Text></View><Text style={styles.rowValue}>{formatTime(log.durationSeconds)} {open ? '▴' : '▾'}</Text></View>
      <View style={styles.metaPillRow}><View style={styles.metaPill}><Text style={styles.metaPillText}>{Math.round(calculateWorkoutVolume(log.entries))} kg volume</Text></View><View style={styles.metaPill}><Text style={styles.metaPillText}>{countCompletedSets(log.entries)} sets</Text></View></View>
    </Pressable>
    {open ? <View style={{ gap: 12, marginTop: 14 }}>
      {draft ? <>
        <Text style={styles.descriptionLabel}>Workout name</Text><TextInput accessibilityLabel="Workout name" value={draft.name} style={styles.textInput} onChangeText={(name) => patch({ name })} />
        <Text style={styles.descriptionLabel}>Date (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Workout date" value={draft.date} style={styles.textInput} onChangeText={(date) => patch({ date })} />
        <NumericField label="Workout duration (seconds)" value={draft.durationSeconds} onChange={(value) => patch({ durationSeconds: value ?? 0 })} />
        <Text style={styles.descriptionLabel}>Workout notes</Text><TextInput accessibilityLabel="Workout notes" multiline value={draft.notes ?? ''} style={styles.textInput} onChangeText={(notes) => patch({ notes })} />
      </> : log.notes ? <Text style={styles.compactText}>{log.notes}</Text> : null}
      {displayed.entries.map((entry) => {
        const metric = getEntryMetric(entry);
        const exercise = exercises.find((item) => item.id === entry.exerciseId);
        return <View key={entry.id} style={[styles.card, { gap: 10 }]}>
          <Text style={styles.rowTitle}>{exercise?.name ?? entry.exerciseId}{entry.skipped ? ' · skipped' : ''}</Text>
          {draft ? <TextInput accessibilityLabel={`${exercise?.name ?? 'Exercise'} notes`} placeholder="Exercise notes" placeholderTextColor={colors.muted} style={styles.textInput} value={entry.notes ?? ''} onChangeText={(notes) => patch({ entries: displayed.entries.map((item) => item.id === entry.id ? { ...item, notes } : item) })} /> : entry.notes ? <Text style={styles.rowMuted}>{entry.notes}</Text> : null}
          {entry.sets.map((set, index) => draft ? <View key={set.id} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, gap: 8 }}>
            <Text style={styles.descriptionLabel}>Set {index + 1}</Text>
            <View style={styles.chipRow}>{(['warmup', 'normal', 'drop', 'failure'] satisfies SetType[]).map((type) => <Pressable key={type} style={[styles.chip, set.type === type && styles.chipActive]} onPress={() => patchSet(entry.id, set.id, { type })}><Text style={styles.chipText}>{type}</Text></Pressable>)}</View>
            <HistoryMetricFields metric={metric} set={set} onChange={(edit) => patchSet(entry.id, set.id, edit)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><NumericField label="RIR (optional, 0–10)" value={set.rir} onChange={(rir) => patchSet(entry.id, set.id, { rir })} /><NumericField label="RPE (optional, 1–10)" value={set.rpe} onChange={(rpe) => patchSet(entry.id, set.id, { rpe })} /></View>
            <TextInput accessibilityLabel={`Set ${index + 1} notes`} placeholder="Set notes" placeholderTextColor={colors.muted} style={styles.textInput} value={set.note ?? ''} onChangeText={(note) => patchSet(entry.id, set.id, { note })} />
            <View style={styles.chipRow}><Pressable style={[styles.chip, set.done && styles.chipActive]} onPress={() => patchSet(entry.id, set.id, { done: !set.done })}><Text style={styles.chipText}>{set.done ? '✓ Completed' : 'Incomplete'}</Text></Pressable><Pressable style={styles.removeButton} onPress={() => patch({ entries: displayed.entries.map((item) => item.id === entry.id ? { ...item, sets: item.sets.filter((candidate) => candidate.id !== set.id) } : item) })}><Text style={styles.removeButtonText}>Remove set</Text></Pressable></View>
          </View> : <View key={set.id}><Text style={styles.rowValue}>{set.done ? '✓' : '—'} {index + 1}. {formatSetPerformance(set, metric)}{set.type !== 'normal' ? ` · ${set.type}` : ''}</Text>{set.note ? <Text style={styles.rowMuted}>{set.note}</Text> : null}</View>)}
          {draft ? <Pressable style={styles.smallButton} onPress={() => addSet(entry.id)}><Text style={styles.smallButtonText}>Add set</Text></Pressable> : null}
        </View>;
      })}
      {records.length ? <View style={styles.card}><Text style={styles.descriptionLabel}>Personal records against earlier workouts</Text>{records.map((record, index) => <Text key={`${record.exerciseId}-${record.type}-${index}`} style={styles.compactText}>{exercises.find((exercise) => exercise.id === record.exerciseId)?.name ?? record.exerciseId}: {formatPersonalRecord(record)}</Text>)}</View> : null}
      {error ? <Text accessibilityRole="alert" style={styles.dangerOutlineText}>{error}</Text> : null}
      {draft ? <View style={styles.templateActions}><Pressable style={styles.templateSecondaryAction} onPress={() => { setDraft(null); setError(''); }}><Text style={styles.secondaryText}>Cancel edit</Text></Pressable><Pressable style={styles.templatePrimaryAction} onPress={save}><Text style={styles.primaryText}>Save changes</Text></Pressable></View> : <View style={styles.chipRow}>
        {onUpdateLog ? <Pressable style={styles.smallButton} onPress={() => { setDraft({ ...log, entries: log.entries.map((entry) => ({ ...entry, sets: entry.sets.map((set) => ({ ...set })) })) }); setConfirmDelete(false); }}><Text style={styles.smallButtonText}>Edit workout</Text></Pressable> : null}
        {onRepeatLog ? <Pressable style={styles.smallButton} onPress={() => onRepeatLog(log)}><Text style={styles.smallButtonText}>Repeat workout</Text></Pressable> : null}
        {onDeleteLog ? <Pressable style={styles.smallButton} onPress={() => setConfirmDelete(true)}><Text style={styles.dangerOutlineText}>Delete</Text></Pressable> : null}
      </View>}
      {confirmDelete && onDeleteLog ? <View style={styles.card}><Text style={styles.compactText}>Delete this workout? Its records and graphs will be recalculated.</Text><View style={styles.templateActions}><Pressable style={styles.templateSecondaryAction} onPress={() => setConfirmDelete(false)}><Text style={styles.secondaryText}>Keep workout</Text></Pressable><Pressable style={styles.templatePrimaryAction} onPress={() => onDeleteLog(log.id)}><Text style={styles.primaryText}>Confirm delete</Text></Pressable></View></View> : null}
    </View> : null}
  </View>;
}

function HistoryMetricFields({ metric, set, onChange }: { metric: ExerciseMetric; set: WorkoutSet; onChange: (edit: Partial<WorkoutSet>) => void }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {metric === 'weight_reps' || metric === 'assisted_reps' ? <NumericField label={metric === 'assisted_reps' ? 'Assistance (kg)' : 'Weight (kg)'} value={set.weightKg} onChange={(weightKg) => onChange({ weightKg: weightKg ?? 0 })} /> : null}
    {metric === 'reps' || metric === 'weight_reps' || metric === 'assisted_reps' ? <>
      <NumericField label="Repetitions" value={set.reps} onChange={(reps) => onChange({ reps: reps ?? 0 })} />
      <NumericField label="Target repetitions" value={set.targetReps} onChange={(targetReps) => onChange({ targetReps: targetReps ?? 0 })} />
      <NumericField label="Range minimum" value={set.repRangeMin} onChange={(repRangeMin) => onChange({ repRangeMin })} />
      <NumericField label="Range maximum" value={set.repRangeMax} onChange={(repRangeMax) => onChange({ repRangeMax })} />
      <NumericField label="Target RIR" value={set.targetRir} onChange={(targetRir) => onChange({ targetRir })} />
    </> : null}
    {metric === 'duration' || metric === 'distance_duration' ? <NumericField label="Duration (seconds)" value={set.durationSeconds ?? 0} onChange={(durationSeconds) => onChange({ durationSeconds: durationSeconds ?? 0 })} /> : null}
    {metric === 'distance_duration' ? <NumericField label="Distance (km)" value={set.distanceKm ?? 0} onChange={(distanceKm) => onChange({ distanceKm: distanceKm ?? 0 })} /> : null}
  </View>;
}

function NumericField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  return <View style={{ minWidth: 100, flexGrow: 1, flexBasis: '40%' }}><Text style={styles.stepperLabel}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={text} style={styles.textInput} onChangeText={(next) => { setText(next); const parsed = Number(next.replace(',', '.')); onChange(next.trim() === '' ? undefined : Number.isFinite(parsed) ? parsed : Number.NaN); }} /></View>;
}
