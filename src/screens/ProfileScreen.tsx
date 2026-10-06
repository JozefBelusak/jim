import { Image, Platform, Text, View } from 'react-native';

import { hamsterLogo } from '../assets';
import { Section, Stat } from '../components/ui';
import { WorkoutHistoryCallbacks, WorkoutHistoryPanel } from '../components/WorkoutHistoryPanel';
import { exerciseDb } from '../data/exercises';
import { formatTime } from '../data/plans';
import { calculateWorkoutVolume } from '../domain/workouts';
import { styles } from '../theme/styles';
import { Exercise, PlanDay, WorkoutLog } from '../types';

type ProfileScreenProps = WorkoutHistoryCallbacks & {
  logs: WorkoutLog[];
  schedule: Record<string, PlanDay>;
  exercises?: Exercise[];
};

export function ProfileScreen({ logs, exercises = exerciseDb, onUpdateLog, onDeleteLog, onRepeatLog }: ProfileScreenProps) {
  const totalVolume = logs.reduce((sum, log) => sum + calculateWorkoutVolume(log.entries), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.profileCard}>
        <Image source={hamsterLogo} style={styles.profileLogo} />
        <View>
          <Text style={styles.eyebrow}>Profile</Text>
          <Text style={styles.cardTitle}>Workout log</Text>
          <Text style={styles.rowMuted}>{logs.length} saved workouts</Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        <Stat label="Workouts" value={`${logs.length}`} />
        <Stat label="Volume" value={formatVolume(totalVolume)} />
        <Stat label="Avg time" value={logs.length ? formatTime(Math.round(logs.reduce((sum, log) => sum + log.durationSeconds, 0) / logs.length)) : '-'} />
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pridať na plochu</Text>
          <Text style={styles.compactText}>
            iPhone: v Safari otvor Zdieľať → Pridať na plochu.
          </Text>
          <Text style={styles.compactText}>
            Android: v Chrome otvor menu ⋮ → Pridať na plochu alebo Nainštalovať aplikáciu.
          </Text>
          <Text style={styles.rowMuted}>
            Tréningy sú uložené v tomto prehliadači na tomto zariadení.
          </Text>
        </View>
      ) : null}

      <Section title="History" />
      {logs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.compactText}>No saved workouts yet.</Text>
        </View>
      ) : null}
      <WorkoutHistoryPanel logs={logs} exercises={exercises} onUpdateLog={onUpdateLog} onDeleteLog={onDeleteLog} onRepeatLog={onRepeatLog} />
    </View>
  );
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
}
