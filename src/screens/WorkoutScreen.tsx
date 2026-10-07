import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';

import { BottomSheet } from '../components/BottomSheet';
import { DisclosureSection } from '../components/DisclosureSection';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { formatSignedTime, formatTime, getExercise } from '../data/plans';
import { formatSetPerformance, getEntryMetric, isValidSetPerformance } from '../domain/metrics';
import { applyProgressionRecommendation, buildProgressionRecommendation, formatPersonalRecord } from '../domain/progress';
import {
  adjustWorkoutDuration, advanceToNextExercise, appendSetToCurrentExercise,
  appendWorkoutExercise, applyWorkoutShortening, calculateWorkoutVolume, completeCurrentSet,
  countCompletedSets, countWorkingSets, getRestTimerRemaining, getWorkoutElapsedSeconds,
  navigateToExercise, pauseWorkout, removeWorkoutSet, reorderWorkoutExercise, replaceWorkoutExercise,
  restoreWorkoutExercise, resumeWorkout, removeWorkoutSuperset, skipWorkoutExercise, suggestWorkoutShortening,
  toggleSupersetWithNext, uncheckWorkoutSet, updateWorkoutSet, WorkoutShorteningProposal,
} from '../domain/workouts';
import { colors, styles } from '../theme/styles';
import { ActiveWorkout, Exercise, ExerciseMetric, PersonalRecord, SetType, WorkoutLog, WorkoutSet } from '../types';

type WorkoutScreenProps = {
  workout: ActiveWorkout;
  exercises: Exercise[];
  now: number;
  previousSets: WorkoutSet[] | null;
  personalRecords: PersonalRecord[];
  logs?: WorkoutLog[];
  machineMemoryPanel?: ReactNode;
  onChange: (workout: ActiveWorkout) => void;
  onFinish: () => void;
  onCancel: () => void;
  onMinimize?: () => void;
};

type WorkoutSheet = 'workout' | 'exercises' | 'exercise' | 'set' | 'picker' | 'finish' | 'remove' | null;

export function WorkoutScreen({ workout, exercises, now, previousSets, personalRecords, logs = [], machineMemoryPanel, onChange, onFinish, onCancel, onMinimize }: WorkoutScreenProps) {
  const [sheet, setSheet] = useState<WorkoutSheet>(null);
  const [picker, setPicker] = useState<'add' | 'replace' | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [leaveMinutes, setLeaveMinutes] = useState('20');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [proposal, setProposal] = useState<WorkoutShorteningProposal | null>(null);
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
  const selectedSet = entry?.sets.find((set) => set.id === selectedSetId) ?? editableSet;
  const selectedSetIndex = selectedSet && entry ? entry.sets.findIndex((set) => set.id === selectedSet.id) : 0;
  const recommendation = entry ? buildProgressionRecommendation(entry, logs, workout.userId) : null;
  const alertKey = `${workout.restStartedAt}:${workout.restNextSetId}`;
  const alertedRestRef = useRef<string | null>(null);
  const hasPending = workout.entries.some((item) => !item.skipped && item.sets.some((set) => !set.done));
  const summary = workout.phase === 'complete';
  const completedSets = countCompletedSets(workout.entries);

  useEffect(() => {
    setMediaError('');
    setPerformanceError('');
    setSelectedSetId(null);
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
    setSheet(null);
  }

  function openPicker(mode: 'add' | 'replace') {
    setPicker(mode);
    setSheet('picker');
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

  function openSetOptions(set: WorkoutSet) {
    setSelectedSetId(set.id);
    setSheet('set');
  }

  function requestFinish() {
    if (hasPending && !summary) setSheet('finish');
    else onFinish();
  }

  return (
    <View style={[styles.screen, local.screen]}>
      <View style={local.toolbar}>
        {onMinimize ? <Pressable style={local.toolbarButton} onPress={onMinimize} accessibilityLabel="Back to overview"><Text style={local.actionText}>‹ Overview</Text></Pressable> : null}
        <View style={local.toolbarSpacer} />
        {!summary ? <Pressable style={local.toolbarButton} onPress={() => onChange(workout.pausedAt === undefined ? pauseWorkout(workout, now) : resumeWorkout(workout, now))} accessibilityLabel={workout.pausedAt === undefined ? 'Pause workout' : 'Resume workout'}>
          <Text style={local.actionText}>{workout.pausedAt === undefined ? 'Pause' : 'Resume'}</Text>
        </Pressable> : null}
        <Pressable style={local.moreButton} onPress={() => setSheet('workout')} accessibilityLabel="Workout options"><Text style={local.moreText}>⋯</Text></Pressable>
      </View>

      <View style={local.workoutIdentity}>
        <Text style={local.workoutName} numberOfLines={1}>{workout.name || 'Workout'}</Text>
        <Text style={local.progressText}>{completedSets} sets done{workout.pausedAt !== undefined ? ' · paused' : summary ? ' · timer stopped' : ''}{workout.deadlineAt ? ` · leave in ${formatSignedTime(Math.ceil((workout.deadlineAt - now) / 1000))}` : ''}</Text>
      </View>

      {summary ? <View style={[styles.card, local.summaryCard]}>
        <Text style={styles.eyebrow}>Workout complete</Text>
        <Text style={styles.cardTitle}>Ready to save</Text>
        <Text style={local.bodyText}>{completedSets} completed sets · {formatVolume(calculateWorkoutVolume(workout.entries))} load volume</Text>
        {personalRecords.length > 0 ? <DisclosureSection title={`${personalRecords.length} new personal records`}>
          {personalRecords.map((record) => <Text key={`${record.exerciseId}-${record.type}-${record.weightKg ?? 'session'}`} style={local.bodyText}>{getExercise(record.exerciseId, exercises).name}: {formatPersonalRecord(record)}</Text>)}
        </DisclosureSection> : null}
        <Pressable style={[styles.primaryWide, local.finishButton]} onPress={requestFinish} accessibilityLabel="Save workout"><Text style={styles.primaryText}>Save workout</Text></Pressable>
      </View> : null}

      {workout.entries.length === 0 ? <View style={[styles.card, local.emptyCard]}>
        <Text style={styles.cardTitle}>Add your first exercise</Text>
        <Text style={local.bodyText}>Search by name, muscle or equipment. You can build the workout as you go.</Text>
        <ExerciseSearch exercises={exercises} onSelect={selectExercise} actionLabel="Add" title="Find an exercise" maxVisible={6} />
      </View> : null}

      {entry && exercise ? <>
        <View style={local.exerciseHeading}>
          <View style={local.headingText}>
            <Text style={local.sectionLabel}>Exercise {visibleIndex + 1} of {workout.entries.length}{entry.skipped ? ' · skipped' : ''}</Text>
            <Text style={styles.cardTitle}>{exercise.name}</Text>
            <Text style={local.bodyMuted}>{metricLabels[metric]}{entry.supersetGroupId ? ' · superset' : ''}</Text>
          </View>
          <Pressable style={local.moreButton} onPress={() => setSheet('exercise')} accessibilityLabel="Exercise options"><Text style={local.moreText}>⋯</Text></Pressable>
        </View>

        {workout.pausedAt !== undefined && !summary ? <Text accessibilityLiveRegion="polite" style={local.statusHint}>Workout paused · resume to complete your next set.</Text> : null}
        {restFinishedNotice && workout.phase === 'set' ? <Text accessibilityLiveRegion="polite" style={local.statusHint}>Rest finished · next set is ready.</Text> : null}
        {workout.phase === 'between' ? <View style={local.inlineNotice}>
          <Text style={local.noticeText}>Exercise finished</Text>
          <Action label="Continue" onPress={() => onChange(advanceToNextExercise(workout, workout.restTargetSeconds))} />
        </View> : null}
        {workout.phase === 'rest' ? <Text style={local.statusHint}>Rest · you can edit your next set below.</Text> : null}
        {performanceError ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={local.errorText}>{performanceError}</Text> : null}

        <View style={styles.setTableCard}>
          <View style={styles.setTableHeader}>
            <Text style={[styles.setHeaderText, styles.setNumberCell]}>Set</Text>
            <Text style={[styles.setHeaderText, styles.setPreviousCell]}>Previous</Text>
            <Text style={[styles.setHeaderText, styles.setMetricCell]}>{metric === 'duration' || metric === 'distance_duration' ? 'Seconds' : metric === 'reps' ? 'Reps' : metric === 'assisted_reps' ? 'Assist kg' : 'Kg'}</Text>
            {metric !== 'duration' && metric !== 'reps' ? <Text style={[styles.setHeaderText, styles.setMetricCell]}>{metric === 'distance_duration' ? 'Km' : 'Reps'}</Text> : null}
            <Text style={[styles.setHeaderText, styles.setDoneCell]}>Done</Text>
          </View>
          {entry.sets.map((set, index) => <SetLogRow key={set.id} set={set} index={index} metric={metric} previousSet={previousSets?.[index]} active={index === editableIndex}
            canComplete={!entry.skipped && workout.pausedAt === undefined && workout.phase !== 'rest'}
            onSelect={() => openSetOptions(set)} onUpdate={(patch) => updateSet(set.id, patch)} onComplete={() => completeSet(set)} />)}
          <View style={local.tableFooter}>
            <Pressable style={local.footerButton} onPress={() => onChange(appendSetToCurrentExercise({ ...workout, exerciseIndex: visibleIndex }, { id: id('set'), createdAt: now }))} accessibilityLabel="Add set">
              <Text style={local.actionText}>+ Add set</Text>
            </Pressable>
            <Pressable style={local.footerButton} onPress={() => { setSelectedSetId(editableSet?.id ?? null); setSheet('set'); }} accessibilityLabel="Set options">
              <Text style={local.bodyMuted}>Set options</Text>
            </Pressable>
          </View>
        </View>
        {editableSet ? <Text style={local.targetHint}>{getSetHint(editableSet, metric)}</Text> : null}

        <View style={local.exerciseNavigation}>
          <Pressable style={[local.navigationButton, visibleIndex === 0 ? local.disabled : null]} disabled={visibleIndex === 0} onPress={() => onChange(navigateToExercise(workout, workout.entries[visibleIndex - 1].id, undefined, now))} accessibilityLabel="Previous exercise"><Text style={local.navigationArrow}>‹</Text></Pressable>
          <Pressable style={local.exerciseListButton} onPress={() => { setPicker(null); setSheet('exercises'); }} accessibilityLabel="Workout exercise list"><Text style={local.actionText}>Exercises · {workout.entries.length}</Text></Pressable>
          <Pressable style={[local.navigationButton, visibleIndex >= workout.entries.length - 1 ? local.disabled : null]} disabled={visibleIndex >= workout.entries.length - 1} onPress={() => onChange(navigateToExercise(workout, workout.entries[visibleIndex + 1].id, undefined, now))} accessibilityLabel="Next exercise"><Text style={local.navigationArrow}>›</Text></Pressable>
        </View>

        {!summary ? <Pressable style={[styles.primaryWide, local.finishButton]} onPress={requestFinish} accessibilityLabel="Finish and save workout"><Text style={styles.primaryText}>Finish & save</Text></Pressable> : null}
      </> : null}

      <BottomSheet visible={sheet === 'exercises'} title="Workout exercises" subtitle="Tap an exercise to log or edit it." onClose={() => setSheet(null)} footer={<Action label="+ Add exercise" onPress={() => openPicker('add')} />}>
        {workout.entries.map((item, index) => <View key={item.id} style={local.exerciseRow}>
          <Pressable style={local.exerciseSelect} onPress={() => { onChange(navigateToExercise(workout, item.id, undefined, now)); setSheet(null); }} accessibilityLabel={`Open ${getExercise(item.exerciseId, exercises).name}`}>
            <Text style={[styles.rowTitle, item.id === entry?.id ? local.selected : null]}>{index + 1}. {getExercise(item.exerciseId, exercises).name}</Text>
            <Text style={styles.rowMuted}>{item.skipped ? 'Skipped' : `${countCompletedSets([item])}/${item.sets.length} done`}{item.supersetGroupId ? ' · superset' : ''}</Text>
          </Pressable>
          <Pressable style={[local.reorderButton, index === 0 ? local.disabled : null]} onPress={() => onChange(reorderWorkoutExercise(workout, item.id, index - 1))} disabled={index === 0} accessibilityLabel={`Move ${getExercise(item.exerciseId, exercises).name} up`}><Text style={local.actionText}>↑</Text></Pressable>
          <Pressable style={[local.reorderButton, index === workout.entries.length - 1 ? local.disabled : null]} onPress={() => onChange(reorderWorkoutExercise(workout, item.id, index + 1))} disabled={index === workout.entries.length - 1} accessibilityLabel={`Move ${getExercise(item.exerciseId, exercises).name} down`}><Text style={local.actionText}>↓</Text></Pressable>
        </View>)}
      </BottomSheet>

      <BottomSheet visible={sheet === 'picker'} title={picker === 'replace' ? 'Replace exercise' : 'Add exercise'} onClose={() => { setPicker(null); setSheet(null); }}>
        {picker === 'replace' && entry?.sets.some((set) => set.done) ? <Text style={local.bodyText}>Completed sets stay with the original exercise. The replacement receives the remaining work.</Text> : null}
        <ExerciseSearch exercises={exercises} onSelect={selectExercise} actionLabel={picker === 'replace' ? 'Replace' : 'Add'} title={picker === 'replace' ? 'Choose replacement' : 'Find an exercise'} maxVisible={8} />
      </BottomSheet>

      <BottomSheet visible={sheet === 'exercise'} title={exercise?.name ?? 'Exercise options'} subtitle="Tools for this exercise" onClose={() => setSheet(null)}>
        {entry && exercise ? <>
          <View style={local.actions}>
            <Action label={entry.skipped ? 'Restore exercise' : 'Skip remaining'} onPress={() => { onChange(entry.skipped ? restoreWorkoutExercise(workout, entry.id, now) : skipWorkoutExercise(workout, entry.id, now)); setSheet(null); }} />
            <Action label="Replace exercise" onPress={() => openPicker('replace')} />
          </View>
          {recommendation ? <DisclosureSection title="Progression suggestion" summary={recommendation.message}>
            <Text style={local.bodyText}>{recommendation.message}</Text>
            {entry.sets.some((set) => !set.done && set.type !== 'warmup') && (recommendation.suggestedWeightKg !== undefined || recommendation.suggestedReps !== undefined || recommendation.suggestedDurationSeconds !== undefined || recommendation.suggestedDistanceKm !== undefined) ? <Action label="Use suggestion for remaining sets" onPress={() => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? applyProgressionRecommendation(item, recommendation) : item) })} /> : null}
          </DisclosureSection> : null}
          <DisclosureSection title="Technique" summary="Instructions and exercise media">
            <Text style={local.bodyText}>{exercise.instructions ?? exercise.technicalInstructions ?? 'No technique notes saved. Add your cues in Exercise notes.'}</Text>
            {exercise.technicalInstructions && exercise.instructions ? <Text style={local.bodyText}>{exercise.technicalInstructions}</Text> : null}
            <View style={local.actions}>
              {exercise.videoUrl ? <Action label="Watch technique video" onPress={() => { void Linking.openURL(exercise.videoUrl ?? '').catch(() => setMediaError('Video could not be opened. Try again when online.')); }} /> : null}
              {exercise.imageUrl ? <Action label="Open exercise image" onPress={() => { void Linking.openURL(exercise.imageUrl ?? '').catch(() => setMediaError('Image could not be opened. Try again when online.')); }} /> : null}
            </View>
            {mediaError ? <Text style={local.errorText}>{mediaError}</Text> : null}
          </DisclosureSection>
          {machineMemoryPanel ? <DisclosureSection title="Gym & machine" summary="Use the same station and settings next time">{machineMemoryPanel}</DisclosureSection> : null}
          <DisclosureSection title="Exercise notes & rest" summary={entry.notes || `${entry.restSeconds ?? workout.restTargetSeconds}s between sets`}>
            <TextInput value={entry.notes ?? ''} onChangeText={(notes) => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? { ...item, notes } : item) })} placeholder="Exercise note" placeholderTextColor={colors.muted} style={styles.compactNoteInput} multiline accessibilityLabel="Exercise note" />
            <OptionalMetric label="Rest seconds" value={entry.restSeconds ?? workout.restTargetSeconds} integer onCommit={(seconds) => onChange({ ...workout, entries: workout.entries.map((item) => item.id === entry.id ? { ...item, restSeconds: seconds ?? 90 } : item) })} />
          </DisclosureSection>
          <DisclosureSection title="Superset" summary={entry.supersetGroupId ? 'Linked exercises alternate after each set' : 'Alternate sets with another exercise'}>
            {entry.supersetGroupId ? <Action label="Remove superset" onPress={() => onChange(removeWorkoutSuperset(workout, entry.supersetGroupId ?? ''))} /> : null}
            {nextExercise && (!entry.supersetGroupId || entry.supersetGroupId !== nextEntry?.supersetGroupId) ? <Action label={`Superset with ${nextExercise.name}`} onPress={() => onChange(toggleSupersetWithNext({ ...workout, exerciseIndex: visibleIndex }, id('superset')))} /> : null}
            {!entry.supersetGroupId && !nextExercise ? <Text style={local.bodyText}>Add another exercise after this one to create a superset.</Text> : null}
          </DisclosureSection>
        </> : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'set'} title={selectedSet ? `Set ${selectedSetIndex + 1} options` : 'Set options'} subtitle={selectedSet ? getSetHint(selectedSet, metric) : undefined} onClose={() => setSheet(null)}>
        {selectedSet ? <>
          <Text style={local.sectionLabel}>Set type</Text>
          <View style={styles.chipRow}>{setTypeOptions.map((option) => <Pressable key={option.value} style={[styles.chip, selectedSet.type === option.value ? styles.chipActive : null]} onPress={() => updateSet(selectedSet.id, { type: option.value })} accessibilityLabel={`Set type ${option.label}`} accessibilityState={{ selected: selectedSet.type === option.value }}><Text style={styles.chipText}>{option.label}</Text></Pressable>)}</View>
          <View style={local.actions}>
            <OptionalMetric label="RIR (0–10)" value={selectedSet.rir} maximum={10} integer onCommit={(rir) => updateSet(selectedSet.id, { rir, rpe: undefined })} />
            <OptionalMetric label="RPE (1–10)" value={selectedSet.rpe} minimum={1} maximum={10} onCommit={(rpe) => updateSet(selectedSet.id, { rpe, rir: undefined })} />
          </View>
          <Text style={local.bodyMuted}>RIR is reps left in reserve. RPE is effort from 1 to 10. Both are optional.</Text>
          <TextInput value={selectedSet.note ?? ''} onChangeText={(note) => updateSet(selectedSet.id, { note })} placeholder="Set note" placeholderTextColor={colors.muted} style={styles.compactNoteInput} multiline accessibilityLabel="Set note" />
          <Action label="Remove set" danger onPress={() => setSheet('remove')} />
        </> : <Text style={local.bodyText}>Add a set to log this exercise.</Text>}
      </BottomSheet>

      <BottomSheet visible={sheet === 'remove'} title={`Remove set ${selectedSetIndex + 1}?`} onClose={() => setSheet('set')} footer={<View style={local.actions}>
        <Action label="Keep set" onPress={() => setSheet('set')} />
        <Action label="Remove set" danger onPress={() => { if (entry && selectedSet) onChange(removeWorkoutSet(workout, entry.id, selectedSet.id, now)); setSelectedSetId(null); setSheet(null); }} />
      </View>}>
        <Text style={local.bodyText}>{selectedSet?.done ? 'This also removes the recorded performance for this set.' : 'This removes the set from the workout.'}</Text>
      </BottomSheet>

      <BottomSheet visible={sheet === 'finish'} title="Finish this workout?" onClose={() => setSheet(null)} footer={<View style={local.actions}>
        <Action label="Keep training" onPress={() => setSheet(null)} />
        <Action label="Finish & save" primary onPress={() => { setSheet(null); onFinish(); }} />
      </View>}>
        <Text style={local.bodyText}>Save {completedSets} completed sets and finish now? Unfinished sets will stay out of your history.</Text>
      </BottomSheet>

      <BottomSheet visible={sheet === 'workout'} title="Workout options" subtitle="Name, notes and time" onClose={() => setSheet(null)}>
        <Text style={local.sectionLabel}>Workout name</Text>
        <TextInput value={workout.name} onChangeText={(name) => onChange({ ...workout, name })} style={styles.textInput} accessibilityLabel="Workout name" />
        <TextInput value={workout.notes ?? ''} onChangeText={(notes) => onChange({ ...workout, notes })} placeholder="Workout note" placeholderTextColor={colors.muted} style={styles.compactNoteInput} multiline accessibilityLabel="Workout note" />
        <DisclosureSection title="Workout stats" summary={`${completedSets} sets · ${formatVolume(calculateWorkoutVolume(workout.entries))} load volume`}>
          <View style={styles.quickStats}>
            <SummaryMetric label="Sets done" value={`${completedSets}`} />
            <SummaryMetric label="Working sets" value={`${countWorkingSets(workout.entries)}`} />
            <SummaryMetric label="Load volume" value={formatVolume(calculateWorkoutVolume(workout.entries))} />
          </View>
        </DisclosureSection>
        <DisclosureSection title="Correct workout time" summary={`Elapsed ${formatTime(elapsed)}`}>
          <Text style={local.bodyText}>Set the actual duration if you forgot to pause.</Text>
          <View style={local.actions}>
            <TextInput value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="decimal-pad" placeholder={`${Math.round(elapsed / 60)} min`} placeholderTextColor={colors.muted} style={[styles.setMetricInput, local.timeInput]} accessibilityLabel="Actual workout duration in minutes" />
            <Action label="Set duration" onPress={() => { const minutes = Number(durationMinutes.replace(',', '.')); if (durationMinutes.trim() && Number.isFinite(minutes) && minutes >= 0) { onChange(adjustWorkoutDuration(workout, minutes * 60, now)); setDurationMinutes(''); } }} />
          </View>
        </DisclosureSection>
        {!summary ? <DisclosureSection title="I need to leave in…" summary={workout.deadlineAt ? `Leave in ${formatSignedTime(Math.ceil((workout.deadlineAt - now) / 1000))}` : 'Fit your remaining sets into the time you have'}>
          <View style={local.actions}>
            <View style={local.deadlineField}><Text style={local.sectionLabel}>Minutes remaining</Text><TextInput value={leaveMinutes} onChangeText={(value) => { setLeaveMinutes(value); setProposal(null); }} keyboardType="number-pad" style={[styles.setMetricInput, local.timeInput]} accessibilityLabel="Minutes remaining before leaving" /></View>
            <Action label="Suggest shorter workout" onPress={() => { const minutes = Number(leaveMinutes.replace(',', '.')); if (leaveMinutes.trim() && Number.isFinite(minutes) && minutes >= 0) setProposal(suggestWorkoutShortening(workout, minutes, now)); }} />
          </View>
          {proposal ? <View style={local.proposal}>
            <Text style={local.bodyText}>Keep {proposal.retainedPendingSets} remaining sets. Estimated {Math.ceil(proposal.estimatedSeconds / 60)} min instead of {Math.ceil(proposal.originalEstimatedSeconds / 60)} min.</Text>
            {proposal.skipEntryIds.length > 0 ? <Text style={local.bodyMuted}>Skip: {proposal.skipEntryIds.map((entryId) => getExercise(workout.entries.find((item) => item.id === entryId)?.exerciseId ?? '', exercises).name).join(', ')}</Text> : null}
            <Text style={local.bodyMuted}>{proposal.removeSetIds.length} unfinished sets removed. Completed work is preserved. Estimate uses your pace and planned rest.</Text>
            <View style={local.actions}><Action label="Keep current workout" onPress={() => setProposal(null)} /><Action label="Apply shorter workout" primary onPress={() => { onChange(applyWorkoutShortening(workout, proposal, now)); setProposal(null); setSheet(null); }} /></View>
          </View> : null}
        </DisclosureSection> : null}
        <Action label="Cancel workout" danger onPress={() => { setSheet(null); onCancel(); }} />
      </BottomSheet>
    </View>
  );
}

export function WorkoutRestDock({ workout, now, onPause, onResume, onAdjust, onSkip }: {
  workout: ActiveWorkout; now: number; onPause: () => void; onResume: () => void; onAdjust: (seconds: number) => void; onSkip: () => void;
}) {
  const remaining = getRestTimerRemaining(workout, now);
  const paused = workout.restPausedRemainingSeconds !== undefined;
  return <View style={[styles.restDock, local.restDock]}>
    <View style={[styles.restDockTimer, local.restTimer]}><Text style={styles.restDockLabel}>{paused ? 'Paused' : 'Rest'}</Text><Text style={[styles.restDockTime, local.restTime, remaining < 0 ? styles.timerOvertime : null]}>{formatSignedTime(remaining)}</Text></View>
    <View style={[styles.restDockActions, local.restActions]}>
      <DockButton label="−30" accessibilityLabel="Reduce rest by 30 seconds" onPress={() => onAdjust(-30)} />
      <DockButton label={paused ? '▶' : 'Ⅱ'} accessibilityLabel={paused ? 'Resume rest timer' : 'Pause rest timer'} onPress={paused ? onResume : onPause} />
      <DockButton label="+30" accessibilityLabel="Add 30 seconds to rest" onPress={() => onAdjust(30)} />
      <Pressable style={[styles.restDockSkip, local.restSkip]} onPress={onSkip} accessibilityLabel="Skip rest"><Text style={styles.restDockSkipText}>Skip</Text></Pressable>
    </View>
  </View>;
}

function SetLogRow({ set, index, metric, previousSet, active, canComplete, onUpdate, onComplete, onSelect }: {
  set: WorkoutSet; index: number; metric: ExerciseMetric; previousSet?: WorkoutSet; active: boolean; canComplete: boolean;
  onUpdate: (patch: Partial<WorkoutSet>) => void; onComplete: () => void; onSelect: () => void;
}) {
  const durationMetric = metric === 'duration' || metric === 'distance_duration';
  return <View style={[styles.setTableRow, active ? styles.setTableRowActive : null]}>
    <Pressable style={[styles.setNumberCell, local.setNumber]} onPress={onSelect} accessibilityLabel={`Select set ${index + 1}`} accessibilityHint="Open set type, effort, notes and removal options"><Text style={styles.setNumberText}>{formatSetNumber(set.type, index)}</Text><Text style={local.setOptionsHint}>⋯</Text></Pressable>
    <Text style={[styles.setPreviousText, styles.setPreviousCell]}>{previousSet ? formatSetPerformance(previousSet, metric) : '—'}</Text>
    <View style={styles.setMetricCell}>
      <SetMetricInput label={`${durationMetric ? 'Duration' : metric === 'reps' ? 'Reps' : metric === 'assisted_reps' ? 'Assistance' : 'Weight'} set ${index + 1}`} value={durationMetric ? set.durationSeconds ?? 0 : metric === 'reps' ? set.reps : set.weightKg} integer={durationMetric || metric === 'reps'} onCommit={(value) => onUpdate(durationMetric ? { durationSeconds: value } : metric === 'reps' ? { reps: value } : { weightKg: value })} />
    </View>
    {metric !== 'duration' && metric !== 'reps' ? <View style={styles.setMetricCell}>
      <SetMetricInput label={`${metric === 'distance_duration' ? 'Distance' : 'Reps'} set ${index + 1}`} value={metric === 'distance_duration' ? set.distanceKm ?? 0 : set.reps} integer={metric !== 'distance_duration'} onCommit={(value) => onUpdate(metric === 'distance_duration' ? { distanceKm: value } : { reps: value })} />
    </View> : null}
    <View style={styles.setDoneCell}>
      {set.done ? <Pressable style={[styles.setDoneComplete, local.doneTouch]} onPress={onComplete} accessibilityRole="checkbox" accessibilityState={{ checked: true }} accessibilityLabel={`Undo set ${index + 1}`}><Text style={styles.setDoneCompleteText}>✓</Text></Pressable> : canComplete ? <Pressable style={[styles.setDoneButton, local.doneTouch, active ? local.activeDone : null]} onPress={onComplete} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Complete set ${index + 1}`}><Text style={[styles.setDoneButtonText, active ? local.activeDoneText : null]}>✓</Text></Pressable> : <View style={styles.setDonePending} accessibilityRole="checkbox" accessibilityState={{ checked: false, disabled: true }} accessibilityLabel={`Complete set ${index + 1}`} />}
    </View>
  </View>;
}

function SetMetricInput({ label, value, integer = false, onCommit }: { label: string; value: number; integer?: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(`${value}`);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(`${value}`); }, [value]);
  return <TextInput accessibilityLabel={label} value={draft} keyboardType="decimal-pad" selectTextOnFocus style={[styles.setMetricInput, local.metricInput]}
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
  return <View style={local.optionalMetric}><Text style={local.sectionLabel}>{label}</Text><TextInput value={draft} keyboardType="decimal-pad" style={[styles.setMetricInput, local.metricInput]} selectTextOnFocus placeholder="Optional" placeholderTextColor={colors.muted} accessibilityLabel={label}
    onFocus={() => { focused.current = true; }}
    onBlur={() => { focused.current = false; setDraft(value === undefined ? '' : `${value}`); }}
    onChangeText={(raw) => {
      setDraft(raw);
      if (!raw.trim()) { onCommit(undefined); return; }
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) onCommit(Math.min(maximum, Math.max(minimum, integer ? Math.round(parsed) : parsed)));
    }} /></View>;
}

function Action({ label, onPress, disabled = false, danger = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; primary?: boolean }) {
  return <Pressable style={[local.action, danger ? local.dangerAction : null, primary ? local.primaryAction : null, disabled ? local.disabled : null]} onPress={onPress} disabled={disabled} accessibilityLabel={label}><Text style={[local.actionText, danger ? local.dangerText : null, primary ? local.primaryActionText : null]}>{label}</Text></Pressable>;
}
function DockButton({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return <Pressable style={[styles.restDockButton, local.dockButton]} onPress={onPress} accessibilityLabel={accessibilityLabel}><Text style={styles.restDockButtonText}>{label}</Text></Pressable>;
}
function SummaryMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}
function formatSetNumber(type: SetType, index: number) {
  if (type === 'warmup') return 'W'; if (type === 'drop') return 'D'; if (type === 'failure') return 'F'; return `${index + 1}`;
}
function formatVolume(value: number) { return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`; }
function getSetHint(set: WorkoutSet, metric: ExerciseMetric) {
  const target = metric === 'distance_duration' ? 'Time in seconds · distance in km'
    : set.repRangeMin !== undefined && set.repRangeMax !== undefined ? `Target ${set.repRangeMin}–${set.repRangeMax} ${metric === 'duration' ? 'seconds' : 'reps'}`
    : `Target ${set.targetReps} ${metric === 'duration' ? 'seconds' : 'reps'}`;
  return `${target}${set.targetRir !== undefined ? ` · target RIR ${set.targetRir}` : ''}${set.rir !== undefined ? ` · RIR ${set.rir}` : set.rpe !== undefined ? ` · RPE ${set.rpe}` : ''}`;
}
const setTypeOptions: { value: SetType; label: string }[] = [{ value: 'warmup', label: 'Warm-up' }, { value: 'normal', label: 'Working' }, { value: 'drop', label: 'Drop' }, { value: 'failure', label: 'Failure' }];
const metricLabels: Record<ExerciseMetric, string> = { weight_reps: 'Weight + reps', reps: 'Reps', duration: 'Duration', distance_duration: 'Distance + duration', assisted_reps: 'Assistance + reps · less assistance is harder' };
const local = StyleSheet.create({
  screen: { gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  toolbarButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
  toolbarSpacer: { flex: 1 },
  moreButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.surface },
  moreText: { color: colors.text, fontSize: 25, lineHeight: 27, fontWeight: '700' },
  workoutIdentity: { gap: 3 },
  workoutName: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  progressText: { color: colors.muted, fontSize: 12 },
  summaryCard: { gap: 8 },
  emptyCard: { gap: 10 },
  exerciseHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  headingText: { flex: 1, gap: 4 },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  bodyMuted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  statusHint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  noticeText: { color: colors.muted, fontSize: 13 },
  errorText: { color: colors.pink, fontSize: 13, lineHeight: 20 },
  tableFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  footerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  setNumber: { minHeight: 44 },
  setOptionsHint: { fontSize: 10, lineHeight: 9, color: colors.muted },
  metricInput: { minHeight: 44 },
  doneTouch: { minHeight: 44, height: 44 },
  activeDone: { backgroundColor: colors.mint, borderColor: colors.mint },
  activeDoneText: { color: colors.ink },
  targetHint: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
  exerciseNavigation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navigationButton: { minHeight: 44, width: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  navigationArrow: { color: colors.text, fontSize: 26, lineHeight: 30 },
  exerciseListButton: { flex: 1, minHeight: 44, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  finishButton: { marginTop: 2, minHeight: 46 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
  action: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 10, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dangerAction: { borderColor: colors.line, marginTop: 8 },
  dangerText: { color: colors.pink },
  primaryAction: { backgroundColor: colors.mint, borderColor: colors.mint },
  primaryActionText: { color: colors.ink },
  disabled: { opacity: 0.35 },
  exerciseRow: { flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 6 },
  exerciseSelect: { flex: 1, minHeight: 48, justifyContent: 'center', gap: 2 },
  reorderButton: { minHeight: 44, minWidth: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8 },
  selected: { color: colors.mint },
  optionalMetric: { flex: 1, minWidth: 100, gap: 6 },
  timeInput: { width: 90, minHeight: 44 },
  deadlineField: { gap: 6 },
  proposal: { gap: 10, paddingTop: 10 },
  restDock: { minHeight: 68, padding: 8, gap: 8, left: 12, right: 12, bottom: 12, borderColor: colors.line },
  restTimer: { minWidth: 55, paddingRight: 8 },
  restTime: { fontSize: 22 },
  restActions: { gap: 4, minWidth: 0 },
  dockButton: { minHeight: 44, paddingHorizontal: 2, borderColor: colors.line },
  restSkip: { flex: 1, minHeight: 44, paddingHorizontal: 2 },
});
