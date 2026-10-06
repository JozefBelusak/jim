import { Pressable, Text, View } from 'react-native';

import { formatDateLabel, formatTime, getMonthLabel, todayIso } from '../data/plans';
import { countCompletedSets } from '../domain/workouts';
import { styles } from '../theme/styles';
import { CalendarDay, Exercise, WorkoutLog } from '../types';

type CalendarScreenProps = {
  exercises: Exercise[];
  weekDays: CalendarDay[];
  weekOffset: number;
  selectedDate: string;
  selectedLogs: WorkoutLog[];
  onSelectDate: (iso: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onOpenPlans: () => void;
};

export function CalendarScreen({
  exercises,
  weekDays,
  weekOffset,
  selectedDate,
  selectedLogs,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
  onOpenPlans,
}: CalendarScreenProps) {
  const headerIso = weekDays[0]?.iso ?? todayIso;

  return (
    <View style={styles.screen}>
      <View style={styles.weekHeader}>
        <Pressable style={styles.iconButton} onPress={onPreviousWeek}>
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>
        <View style={styles.weekHeaderCenter}>
          <Text style={styles.calendarMonth}>{getMonthLabel(headerIso)}</Text>
          <Text style={styles.calendarHint}>
            {weekOffset === 0
              ? 'Workout log · this week'
              : weekOffset > 0
                ? `Workout log · +${weekOffset} week`
                : `Workout log · ${weekOffset} week`}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={onNextWeek}>
          <Text style={styles.iconButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekSchedule}>
        {weekDays.map((day, index) => (
          <Pressable
            key={day.iso}
            style={[
              styles.weekDayCard,
              index === 0 ? styles.weekDayFirst : null,
              index === weekDays.length - 1 ? styles.weekDayLast : null,
              day.iso === todayIso ? styles.calendarToday : null,
              day.iso === selectedDate ? styles.calendarSelected : null,
            ]}
            onPress={() => onSelectDate(day.iso)}
          >
            <Text style={styles.calendarWeekday}>{day.weekday}</Text>
            <Text style={styles.calendarNumber}>{day.dayNumber}</Text>
            <Text style={day.done ? styles.calendarWorkoutDone : styles.calendarWorkoutEmpty}>
              {day.workoutCount > 0 ? `${day.workoutCount}×` : '—'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.rowBetween}>
        <View style={styles.exerciseDetailTitle}>
          <Text style={styles.eyebrow}>Selected day</Text>
          <Text style={styles.cardTitle}>{formatDateLabel(selectedDate)}</Text>
        </View>
        <Text style={styles.rowValue}>
          {selectedLogs.length} {selectedLogs.length === 1 ? 'workout' : 'workouts'}
        </Text>
      </View>

      {selectedLogs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No completed workout</Text>
          <Text style={styles.compactText}>
            Workouts appear here automatically after you finish them.
          </Text>
          <Pressable style={styles.primaryWide} onPress={onOpenPlans}>
            <Text style={styles.primaryText}>OPEN PLANS</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.libraryList}>
          {selectedLogs.map((log) => (
            <View key={log.id} style={styles.historyLogCard}>
              <View style={styles.rowBetween}>
                <View style={styles.exerciseDetailTitle}>
                  <Text style={styles.rowTitle}>{log.name}</Text>
                  <Text style={styles.rowMuted}>{formatExerciseNames(log, exercises)}</Text>
                </View>
                <Text style={styles.rowValue}>{formatTime(log.durationSeconds)}</Text>
              </View>
              <View style={styles.metaPillRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{countCompletedSets(log.entries)} sets</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{formatVolume(log.volumeKg)}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>{log.entries.length} exercises</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatExerciseNames(log: WorkoutLog, exercises: Exercise[]) {
  const names = log.entries.map((entry) =>
    exercises.find((exercise) => exercise.id === entry.exerciseId)?.name ?? 'Unknown exercise',
  );

  return names.join(' · ');
}

function formatVolume(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k kg` : `${Math.round(value)} kg`;
}
