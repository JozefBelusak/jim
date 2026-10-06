import { Pressable, Text, View } from 'react-native';

import { Stat } from '../components/ui';
import { starterTemplateDefinitions } from '../data/starterTemplates';
import { formatDateLabel, formatTime, getTodayIso } from '../data/plans';
import { formatMuscleGroup } from '../domain/exercises';
import { buildWeeklySummary } from '../domain/progress';
import { countCompletedSets } from '../domain/workouts';
import { styles } from '../theme/styles';
import { Exercise, WorkoutLog, WorkoutTemplate } from '../types';

type TodayScreenProps = {
  logs: WorkoutLog[];
  allLogs: WorkoutLog[];
  exercises: Exercise[];
  userId: string;
  today?: string;
  templates: WorkoutTemplate[];
  nextTemplate: WorkoutTemplate | null;
  nextTemplateLastLog: WorkoutLog | null;
  activeWorkoutLabel: string | null;
  activeWorkoutElapsed: number;
  hasActiveWorkout: boolean;
  onStartTemplate: (template: WorkoutTemplate) => void;
  onStartEmpty: () => void;
  onStartStarter: (starterIndex: number) => void;
  onResume: () => void;
  onCancelWorkout: () => void;
  onOpenPlans: () => void;
  onOpenLog?: (logId: string) => void;
};

export function TodayScreen({
  logs,
  allLogs,
  exercises,
  userId,
  today = getTodayIso(),
  templates,
  nextTemplate,
  nextTemplateLastLog,
  activeWorkoutLabel,
  activeWorkoutElapsed,
  hasActiveWorkout,
  onStartTemplate,
  onStartEmpty,
  onStartStarter,
  onResume,
  onCancelWorkout,
  onOpenPlans,
  onOpenLog,
}: TodayScreenProps) {
  const totalSets = logs.reduce((sum, log) => sum + countCompletedSets(log.entries), 0);
  const totalVolume = logs.reduce((sum, log) => sum + log.volumeKg, 0);
  const targetSets = nextTemplate?.exercises.reduce((sum, exercise) => sum + (exercise.targetSets ?? 3), 0) ?? 0;
  const availableTemplates = templates.filter((template) => !template.archived);
  const quickStartTemplates = availableTemplates.filter((template) => template.id !== nextTemplate?.id);
  const canStartNext = Boolean(nextTemplate && nextTemplate.exercises.length > 0);
  const weekly = buildWeeklySummary(allLogs, exercises, userId, today);
  const workoutDelta = weekly.workoutCount - weekly.previousWorkoutCount;

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>{hasActiveWorkout ? 'Live workout' : availableTemplates.length === 0 ? 'Let’s get started' : 'Up next'}</Text>
        <Text style={styles.heroTitle}>
          {hasActiveWorkout ? activeWorkoutLabel ?? 'Workout' : nextTemplate?.name ?? 'Your first workout'}
        </Text>
        <Text style={styles.heroSub}>
          {hasActiveWorkout ? formatDateLabel(today) : nextTemplate?.description ?? 'Pick a ready plan below or start empty and add exercises as you go.'}
        </Text>
        {hasActiveWorkout || nextTemplate ? (
          <View style={styles.quickStats}>
            {hasActiveWorkout ? (
              <>
                <Stat label="Today" value={`${logs.length}`} />
                <Stat label="Sets" value={`${totalSets}`} />
                <Stat label="Live time" value={formatTime(activeWorkoutElapsed)} />
              </>
            ) : (
              <>
                <Stat label="Exercises" value={`${nextTemplate?.exercises.length ?? 0}`} />
                <Stat label="Target sets" value={`${targetSets}`} />
                <Stat label="Last" value={formatRecency(nextTemplateLastLog)} />
              </>
            )}
          </View>
        ) : null}
        {hasActiveWorkout ? (
          <>
            <Pressable style={styles.resumeWide} onPress={onResume}><Text style={styles.primaryText}>RESUME WORKOUT</Text></Pressable>
            <Pressable style={styles.dangerOutlineFull} onPress={onCancelWorkout}><Text style={styles.dangerOutlineText}>Cancel workout</Text></Pressable>
          </>
        ) : (
          <>
            {canStartNext && nextTemplate ? <Pressable style={styles.primaryWide} onPress={() => onStartTemplate(nextTemplate)}><Text style={styles.primaryText}>START {nextTemplate.name.toUpperCase()}</Text></Pressable> : null}
            <Pressable style={canStartNext ? styles.secondaryFull : styles.primaryWide} onPress={onStartEmpty}><Text style={canStartNext ? styles.secondaryText : styles.primaryText}>Start empty workout</Text></Pressable>
            <Pressable style={styles.secondaryFull} onPress={onOpenPlans}><Text style={styles.secondaryText}>{availableTemplates.length ? 'Manage plans' : 'Create my own plan'}</Text></Pressable>
          </>
        )}
      </View>

      {!hasActiveWorkout && availableTemplates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose your first plan</Text>
          <Text style={styles.compactText}>The plan is saved to your library so you can change the exercises and targets any time. Use a light starting load and adjust it in the workout.</Text>
          <View style={styles.quickStartList}>
            {starterTemplateDefinitions.map((starter, index) => (
              <View key={starter.name} style={styles.planQuickCard}>
                <Text style={styles.rowTitle}>{starter.name}</Text>
                <Text style={styles.rowMuted}>{starter.description}</Text>
                <Text style={styles.rowMuted}>{starter.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)?.name ?? id).join(' · ')}</Text>
                <Pressable style={styles.primaryWide} onPress={() => onStartStarter(index)}><Text style={styles.primaryText}>Use and start</Text></Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {!hasActiveWorkout && quickStartTemplates.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick start</Text>
          <View style={styles.quickStartList}>
            {quickStartTemplates.map((template) => (
              <View key={template.id} style={styles.quickStartRow}>
                <View style={styles.exerciseDetailTitle}><Text style={styles.rowTitle}>{template.name}</Text><Text style={styles.rowMuted}>{template.exercises.length} exercises</Text></View>
                <Pressable disabled={template.exercises.length === 0} style={[styles.quickStartButton, template.exercises.length === 0 ? styles.disabledButton : null]} onPress={() => onStartTemplate(template)}><Text style={styles.quickStartButtonText}>Start</Text></Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>This week</Text>
        <Text style={styles.rowMuted}>{weekly.weekStart} – {weekly.weekEnd} · {workoutDelta > 0 ? '+' : ''}{workoutDelta} sessions vs last week</Text>
        <View style={styles.quickStats}>
          <Stat label="Sessions" value={`${weekly.workoutCount}`} />
          <Stat label="Sets" value={`${weekly.completedSets}`} />
          <Stat label="Time" value={`${Math.round(weekly.totalDurationSeconds / 60)} min`} />
        </View>
        <Text style={styles.compactText}>External load volume: {formatVolume(weekly.volumeKg)}</Text>
        <View style={[styles.chipRow, { marginTop: 10 }]}>
          {weekly.muscleSets.map(({ muscle, sets }) => <View key={muscle} style={styles.metaPill}><Text style={styles.metaPillText}>{formatMuscleGroup(muscle)} · {sets} sets</Text></View>)}
        </View>
        {weekly.workoutCount === 0 ? <Text style={styles.compactText}>Your completed workouts and trained muscles will appear here after your first session this week.</Text> : null}
      </View>

      {logs.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.rowBetween}><Text style={styles.cardTitle}>Today’s sessions</Text><Text style={styles.rowValue}>{formatVolume(totalVolume)}</Text></View>
          <View style={styles.progressHistoryList}>
            {logs.map((log) => (
              <Pressable key={log.id} style={styles.progressHistoryRow} disabled={!onOpenLog} onPress={() => onOpenLog?.(log.id)}>
                <View style={styles.exerciseDetailTitle}><Text style={styles.rowTitle}>{log.name}</Text><Text style={styles.rowMuted}>{countCompletedSets(log.entries)} sets{onOpenLog ? ' · Open details' : ''}</Text></View>
                <Text style={styles.rowValue}>{formatTime(log.durationSeconds)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatRecency(log: WorkoutLog | null) {
  if (!log) return 'Never';
  const days = Math.max(0, Math.floor((Date.now() - log.finishedAt) / 86_400_000));
  return days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`;
}
