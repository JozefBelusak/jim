import { Image, Platform, Text, View } from 'react-native';

import { hamsterLogo } from '../assets';
import { Section, Stat } from '../components/ui';
import { formatDateLabel, formatTime } from '../data/plans';
import { countCompletedSets } from '../domain/workouts';
import { styles } from '../theme/styles';
import { PlanDay, WorkoutLog } from '../types';

type ProfileScreenProps = {
  logs: WorkoutLog[];
  schedule: Record<string, PlanDay>;
};

export function ProfileScreen({ logs, schedule }: ProfileScreenProps) {
  const totalVolume = logs.reduce((sum, log) => sum + log.volumeKg, 0);

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
      <View style={styles.libraryList}>
        {logs.map((log) => {
          const day = schedule[log.date];
          const doneSets = countCompletedSets(log.entries);

          return (
            <View key={log.id} style={styles.historyLogCard}>
              <View style={styles.rowBetween}>
                <View style={styles.exerciseDetailTitle}>
                  <Text style={styles.rowTitle}>{log.name || day?.label || 'Workout'}</Text>
                  <Text style={styles.rowMuted}>{formatDateLabel(log.date)}</Text>
                </View>
                <Text style={styles.rowValue}>{formatTime(log.durationSeconds)}</Text>
              </View>
              <View style={styles.metaPillRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{formatVolume(log.volumeKg)}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{doneSets} sets</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
}
