import { Pressable, Text, View } from 'react-native';

import { WorkoutHistoryCallbacks, WorkoutHistoryPanel } from '../components/WorkoutHistoryPanel';
import { formatDateLabel, getMonthLabel, getTodayIso } from '../data/plans';
import { styles } from '../theme/styles';
import { CalendarDay, Exercise, WorkoutLog } from '../types';

type CalendarScreenProps = WorkoutHistoryCallbacks & {
  exercises: Exercise[];
  weekDays: CalendarDay[];
  weekOffset: number;
  selectedDate: string;
  selectedLogs: WorkoutLog[];
  allLogs?: WorkoutLog[];
  initialOpenLogId?: string | null;
  today?: string;
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
  allLogs = selectedLogs,
  initialOpenLogId,
  today = getTodayIso(),
  onUpdateLog,
  onDeleteLog,
  onRepeatLog,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
  onOpenPlans,
}: CalendarScreenProps) {
  const headerIso = weekDays[0]?.iso ?? today;

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
              day.iso === today ? styles.calendarToday : null,
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
        <WorkoutHistoryPanel logs={selectedLogs} allLogs={allLogs} exercises={exercises} initialOpenLogId={initialOpenLogId} onUpdateLog={onUpdateLog} onDeleteLog={onDeleteLog} onRepeatLog={onRepeatLog} />
      )}
    </View>
  );
}
