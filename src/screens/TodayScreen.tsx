import { Pressable, Text, View } from 'react-native';

import { Stat } from '../components/ui';
import { formatDateLabel, formatTime, todayIso } from '../data/plans';
import { countCompletedSets } from '../domain/workouts';
import { styles } from '../theme/styles';
import { WorkoutLog, WorkoutTemplate } from '../types';

type TodayScreenProps = {
  logs: WorkoutLog[];
  templates: WorkoutTemplate[];
  nextTemplate: WorkoutTemplate | null;
  nextTemplateLastLog: WorkoutLog | null;
  activeWorkoutLabel: string | null;
  activeWorkoutElapsed: number;
  hasActiveWorkout: boolean;
  onStartTemplate: (template: WorkoutTemplate) => void;
  onResume: () => void;
  onCancelWorkout: () => void;
  onOpenPlans: () => void;
};

export function TodayScreen({
  logs,
  templates,
  nextTemplate,
  nextTemplateLastLog,
  activeWorkoutLabel,
  activeWorkoutElapsed,
  hasActiveWorkout,
  onStartTemplate,
  onResume,
  onCancelWorkout,
  onOpenPlans,
}: TodayScreenProps) {
  const totalSets = logs.reduce((sum, log) => sum + countCompletedSets(log.entries), 0);
  const totalVolume = logs.reduce((sum, log) => sum + log.volumeKg, 0);
  const targetSets = nextTemplate?.exercises.reduce(
    (sum, exercise) => sum + (exercise.targetSets ?? 3),
    0,
  ) ?? 0;
  const quickStartTemplates = templates.filter((template) => template.id !== nextTemplate?.id);
  const canStartNext = Boolean(nextTemplate && nextTemplate.exercises.length > 0);

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>{hasActiveWorkout ? 'Live workout' : 'Up next'}</Text>
        <Text style={styles.heroTitle}>
          {hasActiveWorkout
            ? activeWorkoutLabel ?? 'Workout'
            : nextTemplate?.name ?? 'Create your first plan'}
        </Text>
        <Text style={styles.heroSub}>
          {hasActiveWorkout
            ? formatDateLabel(todayIso)
            : nextTemplate?.description ?? 'One tap away from your next session.'}
        </Text>
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
        {hasActiveWorkout ? (
          <>
            <Pressable style={styles.resumeWide} onPress={onResume}>
              <Text style={styles.primaryText}>RESUME WORKOUT</Text>
            </Pressable>
            <Pressable style={styles.dangerOutlineFull} onPress={onCancelWorkout}>
              <Text style={styles.dangerOutlineText}>Cancel workout</Text>
            </Pressable>
          </>
        ) : canStartNext && nextTemplate ? (
          <Pressable style={styles.primaryWide} onPress={() => onStartTemplate(nextTemplate)}>
            <Text style={styles.primaryText}>START {nextTemplate.name.toUpperCase()}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryWide} onPress={onOpenPlans}>
            <Text style={styles.primaryText}>CREATE A PLAN</Text>
          </Pressable>
        )}
      </View>

      {!hasActiveWorkout && quickStartTemplates.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Quick start</Text>
            <Pressable onPress={onOpenPlans}>
              <Text style={styles.rowValue}>Manage plans</Text>
            </Pressable>
          </View>
          <View style={styles.quickStartList}>
            {quickStartTemplates.map((template) => (
              <View key={template.id} style={styles.quickStartRow}>
                <View style={styles.exerciseDetailTitle}>
                  <Text style={styles.rowTitle}>{template.name}</Text>
                  <Text style={styles.rowMuted}>{template.exercises.length} exercises</Text>
                </View>
                <Pressable
                  disabled={template.exercises.length === 0}
                  style={[
                    styles.quickStartButton,
                    template.exercises.length === 0 ? styles.disabledButton : null,
                  ]}
                  onPress={() => onStartTemplate(template)}
                >
                  <Text style={styles.quickStartButtonText}>Start</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {logs.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Today’s sessions</Text>
            <Text style={styles.rowValue}>{formatVolume(totalVolume)}</Text>
          </View>
          <View style={styles.progressHistoryList}>
            {logs.map((log) => (
              <View key={log.id} style={styles.progressHistoryRow}>
                <View style={styles.exerciseDetailTitle}>
                  <Text style={styles.rowTitle}>{log.name}</Text>
                  <Text style={styles.rowMuted}>{countCompletedSets(log.entries)} sets</Text>
                </View>
                <Text style={styles.rowValue}>{formatTime(log.durationSeconds)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function formatRecency(log: WorkoutLog | null) {
  if (!log) {
    return 'Never';
  }

  const days = Math.max(0, Math.floor((Date.now() - log.finishedAt) / 86_400_000));
  return days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`;
}
