import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';

import { ExerciseSearch } from '../components/ExerciseSearch';
import { formatSignedTime, formatTime, getExercise } from '../data/plans';
import { formatSetPerformance, getEntryMetric, isValidSetPerformance } from '../domain/metrics';
import { applyProgressionRecommendation, buildProgressionRecommendation, formatPersonalRecord } from '../domain/progress';
import {
  adjustWorkoutDuration, advanceToNextExercise, advanceToNextSet, appendSetToCurrentExercise,
  appendWorkoutExercise, applyWorkoutShortening, calculateWorkoutVolume, completeCurrentSet,
  countCompletedSets, countWorkingSets, getRestTimerRemaining, getWorkoutElapsedSeconds,
  navigateToExercise, pauseWorkout, removeWorkoutSet, reorderWorkoutExercise, replaceWorkoutExercise,
  restoreWorkoutExercise, resumeWorkout, removeWorkoutSuperset, skipWorkoutExercise, suggestWorkoutShortening,
  toggleSupersetWithNext, uncheckWorkoutSet, updateWorkoutSet, WorkoutShorteningProposal,
} from '../domain/workouts';
import { styles } from '../theme/styles';
import { ActiveWorkout, Exercise, ExerciseMetric, PersonalRecord, SetType, WorkoutLog, WorkoutSet } from '../types';

type WorkoutScreenProps = {
  workout: ActiveWorkout;
  exercises: Exercise[];
  now: number;
  previousSets: WorkoutSet[] | null;
  personalRecords: PersonalRecord[];
  logs?: WorkoutLog[];
  onChange: (workout: ActiveWorkout) => void;
  onFinish: () => void;
  onCancel: () => void;
  onMinimize?: () => void;
};

export function WorkoutScreen({ workout, exercises, now, previousSets, personalRecords, logs = [], onChange, onFinish, onCancel, onMinimize }: WorkoutScreenProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [picker, setPicker] = useState<'add' | 'replace' | null>(workout.entries.length === 0 ? 'add' : null);
  const [finishConfirmation, setFinishConfirmation] = useState(false);
  const [removeConfirmation, setRemoveConfirmation] = useState<string | null>(null);
  const [leaveMinutes, setLeaveMinutes] = useState('20');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [proposal, setProposal] = useState<WorkoutShorteningProposal | null>(null);
  const [techniqueOpen, setTechniqueOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [performanceError, setPerformanceError] = useState('');
  const [restFinishedNotice, setRestFinishedNotice] = useState(false);
  const currentEntry = workout.entries[workout.exerciseIndex];
  const entry = workout.phase === 'rest'
    ? workout.entries.find((item) => item.id === workout.restNextExerciseId) ?? currentEntry
    : currentEntry;
  const visibleIndex = entry ? workout.entries.findIndex((item) => item.id === entry.id) : 0;
  const exercise = entry ? getExercise(entry.exerciseId, exercises) : null;
  const nextEntry = workout.entries[visibleIndex + 1];
  const nextExercise = nextEntry ? getExercise(nextEntry.exerciseId, exercises) : null;
  const metric = entry ? getEntryMetric(entry) : 'weight_reps';
  const restRemaining = getRestTimerRemaining(workout, now);
  const elapsed = getWorkoutElapsedSeconds(workout, now);
  const editableIndex = workout.phase === 'rest' && entry
    ? Math.max(0, entry.sets.findIndex((set) => set.id === workout.restNextSetId)) : workout.setIndex;
  const editableSet = entry?.sets[editableIndex];
  const recommendation = entry ? buildProgressionRecommendation(entry, logs, workout.userId) : null;
  const alertKey = `${workout.restStartedAt}:${workout.restNextSetId}`;
  const alertedRestRef = useRef<string | null>(null);
  const hasPending = workout.entries.some((item) => !item.skipped && item.sets.some((set) => !set.done));

  useEffect(() => {
    setAdvancedOpen(false);
    setTechniqueOpen(false);
    setMediaError('');
    setPerformanceError('');
    setRemoveConfirmation(null);
  }, [entry?.id]);

  useEffect(() => {
    if (workout.phase !== 'rest') { alertedRestRef.current = null; return; }
    if (restRemaining <= 0 && alertedRestRef.current !== alertKey) {
      Vibration.vibrate(300);
      setRestFinishedNotice(true);
      alertedRestRef.current = alertKey;
    }
  }, [alertKey, restRemaining, workout.phase]);

  function id(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function selectExercise(exerciseId: string) {
    const selected = exercises.find((item) => item.id === exerciseId);
    if (!selected) return;
    onChange(picker === 'replace' && entry
      ? replaceWorkoutExercise(workout, entry.id, selected, now, id)
      : appendWorkoutExercise(workout, selected, now, id));
    setPicker(null);
  }

  function updateSet(setId: string, patch: Partial<WorkoutSet>) {
    setPerformanceError('');
    if (entry) onChange(updateWorkoutSet(workout, entry.id, setId, patch));
  }

  function completeSet(set: WorkoutSet) {
    setRestFinishedNotice(false);
    if (!entry) return;
    if (!set.done && !isValidSetPerformance(set, metric)) {
      const required = metric === 'duration' ? 'Enter a duration above 0 seconds.'
        : metric === 'distance_duration' ? 'Enter both a distance and a duration above 0.'
        : metric === 'reps' ? 'Enter at least 1 whole repetition.'
        : `Enter at least 1 whole repetition and ${metric === 'assisted_reps' ? 'assistance' : 'weight'} of 0 kg or more.`;
      setPerformanceError(`Set ${entry.sets.findIndex((item) => item.id === set.id) + 1}: ${required}`);
      return;
    }
    setPerformanceError('');
    if (set.done) onChange(uncheckWorkoutSet(workout, entry.id, set.id, now));
    else if (workout.pausedAt === undefined) onChange(completeCurrentSet(navigateToExercise(workout, entry.id, set.id, now), entry.restSeconds ?? workout.restTargetSeconds, now));
  }

  const summary = workout.phase === 'complete';
  return (
    <View style={styles.screen}>
      <View style={[styles.workoutTop, local.topActions]}>
        {onMinimize ? <Pressable style={styles.backButton} onPress={onMinimize} accessibilityLabel="Back to overview"><Text style={styles.secondaryText}>Overview</Text></Pressable> : null}
        <Pressable style={styles.backButton} onPress={onCancel} accessibilityLabel="Cancel workout">
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Text style={styles.rowValue}>{formatTime(elapsed)}{workout.pausedAt !== undefined ? ' · paused' : summary ? ' · stopped' : ''}</Text>
        {!summary ? <Pressable style={styles.backButton} onPress={() => onChange(workout.pausedAt === undefined ? pauseWorkout(workout, now) : resumeWorkout(workout, now))}>
          <Text style={styles.secondaryText}>{workout.pausedAt === undefined ? 'Pause' : 'Resume'}</Text>
        </Pressable> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{summary ? 'Workout complete' : 'Workout in progress'}</Text>
        <TextInput value={workout.name} onChangeText={(name) => onChange({ ...workout, name })} style={styles.textInput} accessibilityLabel="Workout name" />
        <View style={styles.quickStats}>
          <SummaryMetric label="Sets done" value={`${countCompletedSets(workout.entries)}`} />
          <SummaryMetric label="Working sets" value={`${countWorkingSets(workout.entries)}`} />
          <SummaryMetric label="Load volume" value={formatVolume(calculateWorkoutVolume(workout.entries))} />
        </View>
        {summary && personalRecords.length > 0 ? <View style={styles.descriptionBox}>
          <Text style={styles.eyebrow}>{personalRecords.length} new personal records</Text>
          {personalRecords.map((record) => <Text key={`${record.exerciseId}-${record.type}-${record.weightKg ?? 'session'}`} style={styles.descriptionText}>
            {getExercise(record.exerciseId, exercises).name}: {formatPersonalRecord(record)}
          </Text>)}
        </View> : null}
        {workout.deadlineAt ? <Text style={styles.rowMuted}>Leave in {formatSignedTime(Math.ceil((workout.deadlineAt - now) / 1000))}</Text> : null}
        <TextInput value={workout.notes ?? ''} onChangeText={(notes) => onChange({ ...workout, notes })} placeholder="Workout note" placeholderTextColor="#AAAAC4" style={styles.compactNoteInput} multiline />
        <Pressable style={styles.primaryWide} onPress={() => hasPending && !summary ? setFinishConfirmation(true) : onFinish()}>
          <Text style={styles.primaryText}>{summary ? 'SAVE WORKOUT' : 'FINISH & SAVE'}</Text>
        </Pressable>
        {finishConfirmation ? <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>Save {countCompletedSets(workout.entries)} completed sets and finish now? Unfinished sets will stay out of your history.</Text>
          <View style={local.actions}>
            <Action label="Keep training" onPress={() => setFinishConfirmation(false)} />
            <Action label="Finish & save" onPress={() => { setFinishConfirmation(false); onFinish(); }} />
          </View>
        </View> : null}
      </View>

      {workout.entries.length > 0 ? <View style={styles.card}>
        <Text style={styles.descriptionLabel}>Exercises · tap to return or edit</Text>
        {workout.entries.map((item, index) => <View key={item.id} style={local.exerciseRow}>
          <Pressable style={local.exerciseSelect} onPress={() => onChange(navigateToExercise(workout, item.id, undefined, now))}>
            <Text style={[styles.rowTitle, item.id === entry?.id ? local.selected : null]}>{index + 1}. {getExercise(item.exerciseId, exercises).name}</Text>
            <Text style={styles.rowMuted}>{item.skipped ? 'Skipped' : `${countCompletedSets([item])}/${item.sets.length} done`}{item.supersetGroupId ? ' · superset' : ''}</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => onChange(reorderWorkoutExercise(workout, item.id, index - 1))} disabled={index === 0} accessibilityLabel={`Move ${getExercise(item.exerciseId, exercises).name} up`}><Text style={styles.secondaryText}>↑</Text></Pressable>
          <Pressable style={styles.iconButton} onPress={() => onChange(reorderWorkoutExercise(workout, item.id, index + 1))} disabled={index === workout.entries.length - 1} accessibilityLabel={`Move ${getExercise(item.exerciseId, exercises).name} down`}><Text style={styles.secondaryText}>↓</Text></Pressable>
        </View>)}
        <View style={local.actions}>
          <Action label="Previous exercise" disabled={visibleIndex === 0} onPress={() => onChange(navigateToExercise(workout, workout.entries[visibleIndex - 1].id, undefined, now))} />
          <Action label="Next exercise" disabled={visibleIndex >= workout.entries.length - 1} onPress={() => onChange(navigateToExercise(workout, workout.entries[visibleIndex + 1].id, undefined, now))} />
        </View>
      </View> : null}

      {restFinishedNotice && workout.phase === 'set' ? <View style={styles.restEditingHint}><Text accessibilityLiveRegion="polite" style={styles.restEditingHintText}>Rest finished · next set is ready</Text></View> : null}
      {workout.phase === 'between' ? <View style={styles.restEditingHint}>
        <Text style={styles.restEditingHintText}>Exercise finished · ready for the next one</Text>
        <Action label="Continue" onPress={() => onChange(advanceToNextExercise(workout, workout.restTargetSeconds))} />
      </View> : null}
      {workout.phase === 'rest' ? <View style={styles.restEditingHint}>
        <Text style={styles.restEditingHintText}>Rest · {exercise?.name} is ready to edit</Text>
        <Action label="Start next set now" onPress={() => onChange(advanceToNextSet(workout))} />
      </View> : null}

      {entry && exercise ? <>
        <View style={styles.compactWorkoutHeader}>
          <View style={styles.exerciseDetailTitle}>
            <Text style={styles.eyebrow}>Exercise {visibleIndex + 1} / {workout.entries.length}</Text>
            <Text style={styles.cardTitle}>{exercise.name}</Text>
            <Text style={styles.rowMuted}>{metricLabels[metric]}{entry.supersetGroupId ? ' · alternate exercises after each set' : ''}</Text>
          </View>
          <View style={styles.exerciseNumber}><Text style={styles.exerciseNumberText}>{countCompletedSets([entry])}/{entry.sets.length}</Text></View>
        </View>
        <View style={local.actions}>
          <Action label={entry.skipped ? 'Restore exercise' : 'Skip remaining'} onPress={() => onChange(entry.skipped ? restoreWorkoutExercise(workout, entry.id, now) : skipWorkoutExercise(workout, entry.id, now))} />
          <Action label="Replace exercise" onPress={() => setPicker('replace')} />
          <Action label="Technique" onPress={() => setTechniqueOpen((value) => !value)} />
        </View>
        {techniqueOpen ? <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{exercise.instructions ?? exercise.technicalInstructions ?? 'No technique notes saved for this exercise. Add your cues below.'}</Text>
          {exercise.technicalInstructions && exercise.instructions ? <Text style={styles.descriptionText}>{exercise.technicalInstructions}</Text> : null}
          {exercise.videoUrl ? <Action label="Watch technique video" onPress={() => { void Linking.openURL(exercise.videoUrl ?? '').catch(() => setMediaError('Video could not be opened. Try again when online.')); }} /> : null}
          {exercise.imageUrl ? <Action label="Open exercise image" onPress={() => { void Linking.openURL(exercise.imageUrl ?? '').catch(() => setMediaError('Image could not be opened. Try again when online.')); }} /> : null}
          {mediaError ? <Text style={styles.rowMuted}>{mediaError}</Text> : null}
        </View> : null}
        {recommendation ? <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{recommendation.message}</Text>
          {entry.sets.some((set) => !set.done && set.type !== 'warmup') && (recommendation.suggestedWeightKg !== undefined || recommendation.suggestedReps !== undefined || recommendation.suggestedDurationSeconds !== undefined || recommendation.suggestedDistanceKm !== undefined) ? <Action label="Use suggestion for remaining sets" onPress={() => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? applyProgressionRecommendation(item, recommendation) : item) })} /> : null}
        </View> : null}
        {performanceError ? <View style={styles.descriptionBox}><Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.descriptionText}>{performanceError}</Text></View> : null}
        <View style={styles.setTableCard}>
          <View style={styles.setTableHeader}>
            <Text style={[styles.setHeaderText, styles.setNumberCell]}>Set</Text>
            <Text style={[styles.setHeaderText, styles.setPreviousCell]}>Previous</Text>
            <Text style={[styles.setHeaderText, styles.setMetricCell]}>{metric === 'duration' || metric === 'distance_duration' ? 'Seconds' : metric === 'reps' ? 'Reps' : metric === 'assisted_reps' ? 'Assist kg' : 'Kg'}</Text>
            {metric !== 'duration' && metric !== 'reps' ? <Text style={[styles.setHeaderText, styles.setMetricCell]}>{metric === 'distance_duration' ? 'Km' : 'Reps'}</Text> : null}
            <Text style={[styles.setHeaderText, styles.setDoneCell]}>Done</Text>
          </View>
          {entry.sets.map((set, index) => <View key={set.id}>
            <SetLogRow set={set} index={index} metric={metric} previousSet={previousSets?.[index]} active={index === editableIndex}
              canComplete={!entry.skipped && workout.pausedAt === undefined && workout.phase !== 'rest'}
              onSelect={() => onChange(navigateToExercise(workout, entry.id, set.id, now))}
              onUpdate={(patch) => updateSet(set.id, patch)} onComplete={() => completeSet(set)} />
            <View style={local.setHintRow}>
              <Text style={styles.rowMuted}>{metric === 'distance_duration' ? 'Time in seconds · distance in km' : set.repRangeMin !== undefined && set.repRangeMax !== undefined ? `Target ${set.repRangeMin}–${set.repRangeMax} ${metric === 'duration' ? 'seconds' : 'reps'}` : metric === 'duration' ? `Target ${set.targetReps} seconds` : `Target ${set.targetReps} reps`}{set.targetRir !== undefined ? ` · target RIR ${set.targetRir}` : ''}{set.rir !== undefined ? ` · RIR ${set.rir}` : set.rpe !== undefined ? ` · RPE ${set.rpe}` : ''}</Text>
              <Pressable onPress={() => setRemoveConfirmation(set.id)} accessibilityLabel={`Remove set ${index + 1}`}><Text style={styles.removeButtonText}>Remove</Text></Pressable>
            </View>
            {removeConfirmation === set.id ? <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>Remove set {index + 1}{set.done ? ' and its recorded performance' : ''}?</Text>
              <View style={local.actions}><Action label="Keep" onPress={() => setRemoveConfirmation(null)} /><Action label="Remove set" onPress={() => { onChange(removeWorkoutSet(workout, entry.id, set.id, now)); setRemoveConfirmation(null); }} /></View>
            </View> : null}
          </View>)}
          <Pressable style={styles.addSetInline} onPress={() => onChange(appendSetToCurrentExercise({ ...workout, exerciseIndex: visibleIndex }, { id: id('set'), createdAt: now }))}>
            <Text style={styles.addSetInlineText}>+ Add set</Text>
          </Pressable>
        </View>
        <Pressable style={styles.moreButton} onPress={() => setAdvancedOpen((value) => !value)}><Text style={styles.secondaryText}>{advancedOpen ? 'Hide set options' : 'Set options, effort & notes'}</Text></Pressable>
        {advancedOpen ? <View style={styles.card}>
          {editableSet ? <>
            <Text style={styles.descriptionLabel}>Selected set {editableIndex + 1} · tap a set number to select</Text>
            <View style={styles.chipRow}>{setTypeOptions.map((option) => <Pressable key={option.value} style={[styles.chip, editableSet.type === option.value ? styles.chipActive : null]} onPress={() => updateSet(editableSet.id, { type: option.value })}><Text style={styles.chipText}>{option.label}</Text></Pressable>)}</View>
            <View style={local.actions}>
              <OptionalMetric label="RIR (0–10)" value={editableSet.rir} maximum={10} integer onCommit={(rir) => updateSet(editableSet.id, { rir, rpe: undefined })} />
              <OptionalMetric label="RPE (1–10)" value={editableSet.rpe} minimum={1} maximum={10} onCommit={(rpe) => updateSet(editableSet.id, { rpe, rir: undefined })} />
            </View>
            <Text style={styles.rowMuted}>RIR: reps left in reserve. RPE: effort from 1 to 10. Both are optional.</Text>
            <TextInput value={editableSet.note ?? ''} onChangeText={(note) => updateSet(editableSet.id, { note })} placeholder="Set note" placeholderTextColor="#AAAAC4" style={styles.compactNoteInput} multiline />
          </> : <Text style={styles.rowMuted}>Add a set to log this exercise.</Text>}
          <TextInput value={entry.notes ?? ''} onChangeText={(notes) => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? { ...item, notes } : item) })} placeholder="Exercise note" placeholderTextColor="#AAAAC4" style={styles.compactNoteInput} multiline />
          <OptionalMetric label="Rest seconds" value={entry.restSeconds ?? workout.restTargetSeconds} integer onCommit={(seconds) => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? { ...item, restSeconds: seconds ?? 90 } : item) })} />
          {entry.supersetGroupId ? <Action label="Remove superset" onPress={() => onChange(removeWorkoutSuperset(workout, entry.supersetGroupId ?? ''))} /> : null}
          {nextExercise && (!entry.supersetGroupId || entry.supersetGroupId !== nextEntry?.supersetGroupId) ? <Action label={`Superset with ${nextExercise.name}`} onPress={() => onChange(toggleSupersetWithNext({ ...workout, exerciseIndex: visibleIndex }, id('superset')))} /> : null}
        </View> : null}
      </> : null}

      <Action label={picker === 'add' ? 'Close exercise search' : '+ Add exercise'} onPress={() => setPicker(picker === 'add' ? null : 'add')} />
      {picker ? <View style={styles.card}>
        <Text style={styles.rowMuted}>{picker === 'replace' && entry?.sets.some((set) => set.done) ? 'Completed sets stay with the original exercise. The replacement receives only the remaining work.' : 'Search by name, muscle or equipment.'}</Text>
        <ExerciseSearch exercises={exercises} onSelect={selectExercise} actionLabel={picker === 'replace' ? 'Replace' : 'Add'} title={picker === 'replace' ? 'Choose replacement' : 'Add an exercise'} maxVisible={8} />
        <Action label="Close search" onPress={() => setPicker(null)} />
      </View> : null}

      <View style={styles.card}>
        <Text style={styles.descriptionLabel}>Time</Text>
        <Text style={styles.rowMuted}>Correct the elapsed time, including time when you forgot to pause.</Text>
        <View style={local.actions}>
          <TextInput value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="decimal-pad" placeholder={`${Math.round(elapsed / 60)} minutes`} placeholderTextColor="#AAAAC4" style={[styles.setMetricInput, local.timeInput]} accessibilityLabel="Actual workout duration in minutes" />
          <Action label="Set duration" onPress={() => { const minutes = Number(durationMinutes.replace(',', '.')); if (durationMinutes.trim() && Number.isFinite(minutes) && minutes >= 0) { onChange(adjustWorkoutDuration(workout, minutes * 60, now)); setDurationMinutes(''); } }} />
        </View>
        {!summary ? <>
          <Text style={styles.descriptionLabel}>I need to leave in…</Text>
          <View style={local.actions}>
            <TextInput value={leaveMinutes} onChangeText={(value) => { setLeaveMinutes(value); setProposal(null); }} keyboardType="number-pad" style={[styles.setMetricInput, local.timeInput]} accessibilityLabel="Minutes remaining before leaving" />
            <Action label="Suggest shorter workout" onPress={() => { const minutes = Number(leaveMinutes.replace(',', '.')); if (leaveMinutes.trim() && Number.isFinite(minutes) && minutes >= 0) setProposal(suggestWorkoutShortening(workout, minutes, now)); }} />
          </View>
          {proposal ? <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>Keep {proposal.retainedPendingSets} remaining sets. Estimated {Math.ceil(proposal.estimatedSeconds / 60)} min instead of {Math.ceil(proposal.originalEstimatedSeconds / 60)} min.</Text>
            {proposal.skipEntryIds.length > 0 ? <Text style={styles.rowMuted}>Skip: {proposal.skipEntryIds.map((entryId) => getExercise(workout.entries.find((item) => item.id === entryId)?.exerciseId ?? '', exercises).name).join(', ')}</Text> : null}
            <Text style={styles.rowMuted}>{proposal.removeSetIds.length} unfinished sets removed. Completed work is preserved. Estimate uses your pace and planned rest.</Text>
            <View style={local.actions}><Action label="Keep current workout" onPress={() => setProposal(null)} /><Action label="Apply shorter workout" onPress={() => { onChange(applyWorkoutShortening(workout, proposal, now)); setProposal(null); }} /></View>
          </View> : null}
        </> : null}
      </View>
    </View>
  );
}

export function WorkoutRestDock({ workout, now, onPause, onResume, onAdjust, onSkip }: {
  workout: ActiveWorkout; now: number; onPause: () => void; onResume: () => void; onAdjust: (seconds: number) => void; onSkip: () => void;
}) {
  const remaining = getRestTimerRemaining(workout, now);
  const paused = workout.restPausedRemainingSeconds !== undefined;
  return <View style={styles.restDock}>
    <View style={styles.restDockTimer}><Text style={styles.restDockLabel}>{paused ? 'Paused' : 'Rest'}</Text><Text style={[styles.restDockTime, remaining < 0 ? styles.timerOvertime : null]}>{formatSignedTime(remaining)}</Text></View>
    <View style={styles.restDockActions}>
      <DockButton label="-30" onPress={() => onAdjust(-30)} />
      <DockButton label={paused ? '▶' : 'Ⅱ'} onPress={paused ? onResume : onPause} />
      <DockButton label="+30" onPress={() => onAdjust(30)} />
      <Pressable style={styles.restDockSkip} onPress={onSkip}><Text style={styles.restDockSkipText}>Skip</Text></Pressable>
    </View>
  </View>;
}

function SetLogRow({ set, index, metric, previousSet, active, canComplete, onUpdate, onComplete, onSelect }: {
  set: WorkoutSet; index: number; metric: ExerciseMetric; previousSet?: WorkoutSet; active: boolean; canComplete: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void; onComplete: () => void; onSelect: () => void;
}) {
  const durationMetric = metric === 'duration' || metric === 'distance_duration';
  return <View style={[styles.setTableRow, active ? styles.setTableRowActive : null]}>
    <Pressable style={styles.setNumberCell} onPress={onSelect} accessibilityLabel={`Select set ${index + 1}`}><Text style={styles.setNumberText}>{formatSetNumber(set.type, index)}</Text></Pressable>
    <Text style={[styles.setPreviousText, styles.setPreviousCell]}>{previousSet ? formatSetPerformance(previousSet, metric) : '—'}</Text>
    <View style={styles.setMetricCell}>
      <SetMetricInput label={`${durationMetric ? 'Duration' : metric === 'reps' ? 'Reps' : metric === 'assisted_reps' ? 'Assistance' : 'Weight'} set ${index + 1}`} value={durationMetric ? set.durationSeconds ?? 0 : metric === 'reps' ? set.reps : set.weightKg} integer={durationMetric || metric === 'reps'} onCommit={(value) => onUpdate(durationMetric ? { durationSeconds: value } : metric === 'reps' ? { reps: value } : { weightKg: value })} />
    </View>
    {metric !== 'duration' && metric !== 'reps' ? <View style={styles.setMetricCell}>
      <SetMetricInput label={`${metric === 'distance_duration' ? 'Distance' : 'Reps'} set ${index + 1}`} value={metric === 'distance_duration' ? set.distanceKm ?? 0 : set.reps} integer={metric !== 'distance_duration'} onCommit={(value) => onUpdate(metric === 'distance_duration' ? { distanceKm: value } : { reps: value })} />
    </View> : null}
    <View style={styles.setDoneCell}>
      {set.done ? <Pressable style={styles.setDoneComplete} onPress={onComplete} accessibilityLabel={`Undo set ${index + 1}`}><Text style={styles.setDoneCompleteText}>✓</Text></Pressable> : canComplete ? <Pressable style={styles.setDoneButton} onPress={onComplete} accessibilityLabel={`Complete set ${index + 1}`}><Text style={styles.setDoneButtonText}>✓</Text></Pressable> : <View style={styles.setDonePending} />}
    </View>
  </View>;
}

function SetMetricInput({ label, value, integer = false, onCommit }: { label: string; value: number; integer?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(`${value}`);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(`${value}`); }, [value]);
  return <TextInput accessibilityLabel={label} value={draft} keyboardType="decimal-pad" selectTextOnFocus style={styles.setMetricInput}
    onFocus={() => { focused.current = true; }}
    onBlur={() => { focused.current = false; setDraft(`${value}`); }}
    onChangeText={(raw) => {
      setDraft(raw);
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) onCommit(integer ? Math.max(0, Math.round(parsed)) : Math.max(0, parsed));
    }} />;
}

function OptionalMetric({ label, value, integer = false, minimum = 0, maximum = Number.MAX_SAFE_INTEGER, onCommit }: {
  label: string; value?: number; integer?: boolean; minimum?: number; maximum?: number; onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : `${value}`);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value === undefined ? '' : `${value}`); }, [value]);
  return <View style={local.optionalMetric}><Text style={styles.descriptionLabel}>{label}</Text><TextInput value={draft} keyboardType="decimal-pad" style={styles.setMetricInput} selectTextOnFocus placeholder="Optional" placeholderTextColor="#AAAAC4" accessibilityLabel={label}
    onFocus={() => { focused.current = true; }}
    onBlur={() => { focused.current = false; setDraft(value === undefined ? '' : `${value}`); }}
    onChangeText={(raw) => {
      setDraft(raw);
      if (!raw.trim()) { onCommit(undefined); return; }
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) onCommit(Math.min(maximum, Math.max(minimum, integer ? Math.round(parsed) : parsed)));
    }} /></View>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable style={[styles.secondaryFull, local.action, disabled ? local.disabled : null]} onPress={onPress} disabled={disabled}><Text style={styles.secondaryText}>{label}</Text></Pressable>;
}
function DockButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.restDockButton} onPress={onPress}><Text style={styles.restDockButtonText}>{label}</Text></Pressable>;
}
function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function formatSetNumber(type: SetType, index: number) {
  if (type === 'warmup') return 'W'; if (type === 'drop') return 'D'; if (type === 'failure') return 'F'; return `${index + 1}`;
}
function formatVolume(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`; }
const setTypeOptions: { value: SetType; label: string }[] = [{ value: 'warmup', label: 'Warm-up' }, { value: 'normal', label: 'Working' }, { value: 'drop', label: 'Drop' }, { value: 'failure', label: 'Failure' }];
const metricLabels: Record<ExerciseMetric, string> = { weight_reps: 'Weight + reps', reps: 'Reps', duration: 'Duration', distance_duration: 'Distance + duration', assisted_reps: 'Assistance + reps · less assistance is harder' };
const local = StyleSheet.create({
  topActions: { flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  action: { flexGrow: 1, flexBasis: 110, marginTop: 0, minHeight: 42 },
  disabled: { opacity: 0.35 },
  exerciseRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 },
  exerciseSelect: { flex: 1, minHeight: 40, justifyContent: 'center' },
  selected: { color: '#00FFB3' },
  setHintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', padding: 8 },
  optionalMetric: { flex: 1, minWidth: 100, gap: 6, marginTop: 8 },
  timeInput: { width: 95, flexBasis: 95, flexGrow: 0, minHeight: 44 },
});
