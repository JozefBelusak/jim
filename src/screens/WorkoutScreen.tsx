import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, Vibration, View } from 'react-native';

import { formatSignedTime, formatTime, getExercise } from '../data/plans';
import {
  calculateWorkoutVolume,
  countCompletedSets,
  countWorkingSets,
  getRestTimerRemaining,
} from '../domain/workouts';
import { styles } from '../theme/styles';
import { ActiveWorkout, Exercise, PersonalRecord, SetType, WorkoutSet } from '../types';

type WorkoutScreenProps = {
  workout: ActiveWorkout;
  exercises: Exercise[];
  now: number;
  previousSets: WorkoutSet[] | null;
  personalRecords: PersonalRecord[];
  onUpdateSetAtIndex: (setIndex: number, patch: Partial<WorkoutSet>) => void;
  onUpdateWorkoutNotes: (notes: string) => void;
  onUpdateExerciseNotes: (notes: string) => void;
  onCompleteSet: () => void;
  onNextExercise: () => void;
  onAddSet: () => void;
  onToggleSuperset: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

export function WorkoutScreen({
  workout,
  exercises,
  now,
  previousSets,
  personalRecords,
  onUpdateSetAtIndex,
  onUpdateWorkoutNotes,
  onUpdateExerciseNotes,
  onCompleteSet,
  onNextExercise,
  onAddSet,
  onToggleSuperset,
  onFinish,
  onCancel,
}: WorkoutScreenProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const entry = workout.entries[workout.exerciseIndex];
  const exercise = getExercise(entry.exerciseId, exercises);
  const nextEntry = workout.entries[workout.exerciseIndex + 1];
  const nextExercise = nextEntry ? getExercise(nextEntry.exerciseId, exercises) : null;
  const workoutElapsed = Math.max(0, Math.floor((now - workout.startedAt) / 1000));
  const restRemaining = getRestTimerRemaining(workout, now);
  const restAlertKey = `${workout.exerciseIndex}:${workout.setIndex}`;
  const alertedRestRef = useRef<string | null>(null);
  const editableSetIndex = workout.phase === 'rest'
    ? Math.min(workout.setIndex + 1, entry.sets.length - 1)
    : workout.setIndex;
  const editableSet = entry.sets[editableSetIndex];
  const isSupersetWithNext = Boolean(
    entry.supersetGroupId && entry.supersetGroupId === nextEntry?.supersetGroupId,
  );

  useEffect(() => {
    setAdvancedOpen(false);
  }, [workout.exerciseIndex]);

  useEffect(() => {
    if (workout.phase !== 'rest') {
      alertedRestRef.current = null;
      return;
    }

    if (restRemaining <= 0 && alertedRestRef.current !== restAlertKey) {
      Vibration.vibrate(300);
      alertedRestRef.current = restAlertKey;
    }
  }, [restAlertKey, restRemaining, workout.phase]);

  if (workout.phase === 'complete') {
    return (
      <View style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Workout complete</Text>
          <Text style={styles.heroTitle}>{workout.name}</Text>
          <Text style={styles.heroSub}>The useful part: what you did and what improved.</Text>
          <View style={styles.quickStats}>
            <SummaryMetric label="Time" value={formatTime(workoutElapsed)} />
            <SummaryMetric label="Exercises" value={`${workout.entries.length}`} />
            <SummaryMetric label="Sets" value={`${countCompletedSets(workout.entries)}`} />
          </View>
          <View style={styles.quickStats}>
            <SummaryMetric label="Working" value={`${countWorkingSets(workout.entries)}`} />
            <SummaryMetric label="Volume" value={formatVolume(calculateWorkoutVolume(workout.entries))} />
          </View>
          {personalRecords.length > 0 ? (
            <View style={styles.descriptionBox}>
              <Text style={styles.eyebrow}>
                {personalRecords.length} new {personalRecords.length === 1 ? 'PR' : 'PRs'}
              </Text>
              <View style={styles.progressHistoryList}>
                {personalRecords.map((record) => (
                  <View
                    key={`${record.exerciseId}-${record.type}-${record.weightKg ?? 'session'}`}
                    style={styles.progressHistoryRow}
                  >
                    <View style={styles.exerciseDetailTitle}>
                      <Text style={styles.rowTitle}>
                        {getExercise(record.exerciseId, exercises).name}
                      </Text>
                      <Text style={styles.rowMuted}>{formatPersonalRecord(record)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <TextInput
            value={workout.notes ?? ''}
            onChangeText={onUpdateWorkoutNotes}
            placeholder="Optional workout note"
            placeholderTextColor="#AAAAC4"
            style={styles.noteInput}
            multiline
          />
          <Pressable style={styles.primaryWide} onPress={onFinish}>
            <Text style={styles.primaryText}>SAVE WORKOUT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (workout.phase === 'between') {
    return (
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Exercise complete</Text>
        <Text style={styles.heroTitle}>{exercise.name}</Text>
        <Text style={styles.heroSub}>Next: {nextExercise?.name}</Text>
        <Pressable style={styles.primaryWide} onPress={onNextExercise}>
          <Text style={styles.primaryText}>CONTINUE</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.workoutTop}>
        <Pressable style={styles.backButton} onPress={onCancel}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
        <Text style={styles.rowValue}>{formatTime(workoutElapsed)}</Text>
      </View>

      <View style={styles.compactWorkoutHeader}>
        <View style={styles.exerciseDetailTitle}>
          <Text style={styles.eyebrow}>
            Exercise {workout.exerciseIndex + 1} / {workout.entries.length}
          </Text>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
          {nextExercise ? <Text style={styles.rowMuted}>Next: {nextExercise.name}</Text> : null}
        </View>
        <View style={styles.exerciseNumber}>
          <Text style={styles.exerciseNumberText}>
            {countCompletedSets([entry])}/{entry.sets.length}
          </Text>
        </View>
      </View>

      {workout.phase === 'rest' ? (
        <View style={styles.restEditingHint}>
          <Text style={styles.restEditingHintText}>Rest running · next set is ready to edit</Text>
        </View>
      ) : null}

      <View style={styles.setTableCard}>
        <View style={styles.setTableHeader}>
          <Text style={[styles.setHeaderText, styles.setNumberCell]}>Set</Text>
          <Text style={[styles.setHeaderText, styles.setPreviousCell]}>Previous</Text>
          <Text style={[styles.setHeaderText, styles.setMetricCell]}>Kg</Text>
          <Text style={[styles.setHeaderText, styles.setMetricCell]}>Reps</Text>
          <Text style={[styles.setHeaderText, styles.setDoneCell]}>Done</Text>
        </View>
        {entry.sets.map((set, index) => (
          <SetLogRow
            key={set.id}
            set={set}
            index={index}
            previousSet={previousSets?.[index]}
            active={index === editableSetIndex}
            canComplete={workout.phase === 'set' && index === workout.setIndex}
            onUpdate={(patch) => onUpdateSetAtIndex(index, patch)}
            onComplete={onCompleteSet}
          />
        ))}
        <Pressable style={styles.addSetInline} onPress={onAddSet}>
          <Text style={styles.addSetInlineText}>+ Add set</Text>
        </Pressable>
      </View>

      <Pressable style={styles.moreButton} onPress={() => setAdvancedOpen((current) => !current)}>
        <Text style={styles.secondaryText}>{advancedOpen ? 'Hide options' : 'More options'}</Text>
      </Pressable>

      {advancedOpen ? (
        <View style={styles.card}>
          <Text style={styles.descriptionLabel}>Set {editableSetIndex + 1} type</Text>
          <View style={[styles.chipRow, styles.workoutSetTypeRow]}>
            {setTypeOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.chip, editableSet.type === option.value ? styles.chipActive : null]}
                onPress={() => onUpdateSetAtIndex(editableSetIndex, { type: option.value })}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={editableSet.note ?? ''}
            onChangeText={(note) => onUpdateSetAtIndex(editableSetIndex, { note })}
            placeholder="Optional set note"
            placeholderTextColor="#AAAAC4"
            style={styles.compactNoteInput}
            multiline
          />
          <TextInput
            value={entry.notes ?? ''}
            onChangeText={onUpdateExerciseNotes}
            placeholder="Optional exercise note"
            placeholderTextColor="#AAAAC4"
            style={styles.compactNoteInput}
            multiline
          />
          {nextExercise ? (
            <Pressable style={styles.secondaryFull} onPress={onToggleSuperset}>
              <Text style={styles.secondaryText}>
                {isSupersetWithNext ? 'Remove superset' : `Superset with ${nextExercise.name}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function WorkoutRestDock({
  workout,
  now,
  onPause,
  onResume,
  onAdjust,
  onSkip,
}: {
  workout: ActiveWorkout;
  now: number;
  onPause: () => void;
  onResume: () => void;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
}) {
  const remaining = getRestTimerRemaining(workout, now);
  const paused = workout.restPausedRemainingSeconds !== undefined;

  return (
    <View style={styles.restDock}>
      <View style={styles.restDockTimer}>
        <Text style={styles.restDockLabel}>{paused ? 'Paused' : 'Rest'}</Text>
        <Text style={[styles.restDockTime, remaining < 0 ? styles.timerOvertime : null]}>
          {formatSignedTime(remaining)}
        </Text>
      </View>
      <View style={styles.restDockActions}>
        <DockButton label="-30" onPress={() => onAdjust(-30)} />
        <DockButton label={paused ? '▶' : 'Ⅱ'} onPress={paused ? onResume : onPause} />
        <DockButton label="+30" onPress={() => onAdjust(30)} />
        <Pressable style={styles.restDockSkip} onPress={onSkip}>
          <Text style={styles.restDockSkipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SetLogRow({
  set,
  index,
  previousSet,
  active,
  canComplete,
  onUpdate,
  onComplete,
}: {
  set: WorkoutSet;
  index: number;
  previousSet?: WorkoutSet;
  active: boolean;
  canComplete: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void;
  onComplete: () => void;
}) {
  return (
    <View style={[styles.setTableRow, active ? styles.setTableRowActive : null]}>
      <View style={styles.setNumberCell}>
        <Text style={styles.setNumberText}>{formatSetNumber(set.type, index)}</Text>
      </View>
      <Text style={[styles.setPreviousText, styles.setPreviousCell]} numberOfLines={1}>
        {previousSet ? `${previousSet.weightKg}×${previousSet.reps}` : '—'}
      </Text>
      <View style={styles.setMetricCell}>
        <SetMetricInput
          value={set.weightKg}
          onCommit={(weightKg) => onUpdate({ weightKg })}
        />
      </View>
      <View style={styles.setMetricCell}>
        <SetMetricInput value={set.reps} onCommit={(reps) => onUpdate({ reps })} integer />
      </View>
      <View style={styles.setDoneCell}>
        {set.done ? (
          <View style={styles.setDoneComplete}>
            <Text style={styles.setDoneCompleteText}>✓</Text>
          </View>
        ) : canComplete ? (
          <Pressable style={styles.setDoneButton} onPress={onComplete}>
            <Text style={styles.setDoneButtonText}>✓</Text>
          </Pressable>
        ) : (
          <View style={styles.setDonePending} />
        )}
      </View>
    </View>
  );
}

function SetMetricInput({
  value,
  integer = false,
  onCommit,
}: {
  value: number;
  integer?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <TextInput
      key={`${value}`}
      defaultValue={`${value}`}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={styles.setMetricInput}
      onEndEditing={(event) => {
        const parsed = Number(event.nativeEvent.text.replace(',', '.'));
        if (Number.isFinite(parsed)) {
          onCommit(integer ? Math.max(0, Math.round(parsed)) : Math.max(0, parsed));
        }
      }}
    />
  );
}

function DockButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.restDockButton} onPress={onPress}>
      <Text style={styles.restDockButtonText}>{label}</Text>
    </Pressable>
  );
}

const setTypeOptions: { value: SetType; label: string }[] = [
  { value: 'warmup', label: 'Warm-up' },
  { value: 'normal', label: 'Working' },
  { value: 'drop', label: 'Drop' },
  { value: 'failure', label: 'Failure' },
];

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatSetNumber(type: SetType, index: number) {
  if (type === 'warmup') return 'W';
  if (type === 'drop') return 'D';
  if (type === 'failure') return 'F';
  return `${index + 1}`;
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`;
}

function formatPersonalRecord(record: PersonalRecord) {
  switch (record.type) {
    case 'highest_weight':
      return `Highest weight · ${record.weightKg} kg × ${record.reps}`;
    case 'reps_at_weight':
      return `Rep PR · ${record.weightKg} kg × ${record.reps}`;
    case 'estimated_1rm':
      return `Estimated 1RM · ${record.value.toFixed(1)} kg`;
    case 'set_volume':
      return `Set volume · ${Math.round(record.value)} kg`;
    case 'exercise_session_volume':
      return `Exercise volume · ${Math.round(record.value)} kg`;
  }
}
