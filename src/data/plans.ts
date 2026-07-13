import { CalendarDay, PlanDay, PlanExercise, TabKey, WorkoutLog, WorkoutSet } from '../types';
import { exerciseDb } from './exercises';

export const todayIso = toLocalIsoDate(new Date());
export const calendarWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const calendarMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'library', label: 'Library' },
  { key: 'profile', label: 'Profile' },
];

export function buildEmptyWorkout(iso: string): PlanDay {
  return {
    id: iso,
    date: iso,
    label: 'New workout',
    focus: 'Custom training',
    exercises: [],
  };
}

export function cloneWorkout(workout: PlanDay): PlanDay {
  return {
    ...workout,
    exercises: workout.exercises.map((item) => ({ ...item })),
  };
}

export function createSets(item: PlanExercise): WorkoutSet[] {
  return Array.from({ length: item.sets }, (_, index) => ({
    id: `set-${index + 1}`,
    targetReps: item.reps,
    reps: item.reps,
    weightKg: item.weightKg,
    done: false,
    note: '',
  }));
}

export function getExercise(exerciseId: string) {
  return exerciseDb.find((exercise) => exercise.id === exerciseId) ?? exerciseDb[0];
}

export function getWorkoutForDate(schedule: Record<string, PlanDay>, iso: string) {
  return schedule[iso] ? cloneWorkout(schedule[iso]) : buildEmptyWorkout(iso);
}

export function addDays(iso: string, amount: number) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return toIsoDate(date);
}

export function startOfWeek(iso: string) {
  const date = parseIsoDate(iso);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return toIsoDate(date);
}

export function buildWeekDays(
  schedule: Record<string, PlanDay>,
  logs: WorkoutLog[],
  weekOffset: number,
): CalendarDay[] {
  const weekStart = addDays(startOfWeek(todayIso), weekOffset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const iso = addDays(weekStart, index);
    const date = parseIsoDate(iso);
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()];

    return {
      iso,
      weekday,
      dayNumber: String(date.getUTCDate()),
      inMonth: true,
      planDay: schedule[iso],
      done: logs.some((log) => log.date === iso),
    };
  });
}

export function isPastDate(iso: string) {
  return iso < todayIso;
}

export function formatDateLabel(iso: string) {
  const date = parseIsoDate(iso);
  const weekday = calendarWeekdays[(date.getUTCDay() + 6) % 7];
  return `${weekday}, ${date.getUTCDate()}. ${date.getUTCMonth() + 1}.`;
}

export function getMonthLabel(iso: string) {
  return calendarMonths[parseIsoDate(iso).getUTCMonth()].toUpperCase();
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatSignedTime(seconds: number) {
  return seconds < 0 ? `-${formatTime(Math.abs(seconds))}` : formatTime(seconds);
}

export function screenTitle(tab: TabKey) {
  switch (tab) {
    case 'library':
      return 'LIBRARY';
    case 'calendar':
      return 'CALENDAR';
    case 'profile':
      return 'PROFILE';
    case 'workout':
      return 'WORKOUT';
    default:
      return 'TODAY';
  }
}
