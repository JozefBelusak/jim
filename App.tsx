import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { exerciseDb } from './src/data/exercises';
import {
  buildEmptyWorkout,
  addDays,
  buildWeekDays,
  cloneWorkout,
  createSets,
  formatDateLabel,
  formatSignedTime,
  formatTime,
  getMonthLabel,
  getExercise,
  getWorkoutForDate,
  isPastDate,
  screenTitle,
  tabs,
  todayIso,
} from './src/data/plans';
import { styles } from './src/theme/styles';
import {
  ActiveWorkout,
  CalendarDay,
  Exercise,
  Level,
  PlanDay,
  PlanExercise,
  TabKey,
  WorkoutLog,
  WorkoutSet,
} from './src/types';

const hamsterLogo = require('./hamsterlogo.png') as ImageSourcePropType;
const muscleFilters = ['All', ...Array.from(new Set(exerciseDb.map((exercise) => primaryMuscle(exercise.muscle))))];
const defaultPlanDate = addDays(todayIso, 1);
const storageKey = 'jimappka.training.v1';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function primaryMuscle(muscle: string) {
  return muscle.split('/')[0].trim();
}

export default function App() {
  const [tab, setTab] = useState<TabKey>('today');
  const [schedule, setSchedule] = useState<Record<string, PlanDay>>({});
  const [selectedDate, setSelectedDate] = useState(defaultPlanDate);
  const [draftWorkout, setDraftWorkout] = useState(() => buildEmptyWorkout(defaultPlanDate));
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseDb[0].id);
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [weekOffset, setWeekOffset] = useState(0);
  const [level, setLevel] = useState<Level>('simple');
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const selectedDay = draftWorkout;
  const selectedExercise = getExercise(selectedExerciseId);
  const todayDay = schedule[todayIso] ?? buildEmptyWorkout(todayIso);
  const weekDays = buildWeekDays(schedule, logs, weekOffset);
  const selectedDateReadOnly = isPastDate(selectedDate);
  const activeDay = activeWorkout
    ? schedule[activeWorkout.dayId] ?? buildEmptyWorkout(activeWorkout.dayId)
    : null;
  const activeWorkoutElapsed = activeWorkout
    ? Math.max(0, Math.floor((nowTick - activeWorkout.startedAt) / 1000))
    : 0;

  useEffect(() => {
    let mounted = true;

    async function loadStoredTraining() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!mounted || !raw) {
          return;
        }

        const parsed = JSON.parse(raw) as {
          schedule?: Record<string, PlanDay>;
          logs?: WorkoutLog[];
          activeWorkout?: ActiveWorkout | null;
        };
        const storedSchedule = parsed.schedule ?? {};
        const restoredWorkout = parsed.activeWorkout ?? null;
        const restoredDate = restoredWorkout?.dayId ?? selectedDate;
        const storedWorkout = getWorkoutForDate(storedSchedule, restoredDate);

        setSchedule(storedSchedule);
        setLogs(parsed.logs ?? []);
        setActiveWorkout(restoredWorkout);
        setSelectedDate(restoredDate);
        setDraftWorkout(storedWorkout);
        setSelectedExerciseId(
          restoredWorkout?.entries[restoredWorkout.exerciseIndex]?.exerciseId ??
            storedWorkout.exercises[0]?.exerciseId ??
            exerciseDb[0].id,
        );
        if (restoredWorkout) {
          setNowTick(Date.now());
        }
      } catch {
        // Ignore invalid local data and keep the app usable.
      } finally {
        if (mounted) {
          setStorageReady(true);
        }
      }
    }

    loadStoredTraining();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    AsyncStorage.setItem(storageKey, JSON.stringify({ schedule, logs, activeWorkout })).catch(() => {
      // Local persistence failure should not block workout tracking.
    });
  }, [activeWorkout, logs, schedule, storageReady]);

  useEffect(() => {
    if (!activeWorkout) {
      return;
    }

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWorkout]);

  function selectDate(iso: string, openPlanner: boolean) {
    const workout = getWorkoutForDate(schedule, iso);
    setSelectedDate(iso);
    setDraftWorkout(workout);
    setSelectedExerciseId(workout.exercises[0]?.exerciseId ?? exerciseDb[0].id);
    setPlannerOpen(openPlanner);
    setTab('calendar');
  }

  function openDateInPlan(iso: string) {
    selectDate(iso, true);
  }

  function shiftWeek(direction: -1 | 1) {
    const nextDate = addDays(selectedDate, direction * 7);
    setWeekOffset((current) => current + direction);
    selectDate(nextDate, false);
  }

  function persistWorkout(workout: PlanDay) {
    if (selectedDateReadOnly) {
      return;
    }

    setSchedule((current) => ({
      ...current,
      [selectedDate]: cloneWorkout({ ...workout, id: selectedDate, date: selectedDate }),
    }));
  }

  function clearSelectedWorkout() {
    if (selectedDateReadOnly) {
      return;
    }

    setSchedule((current) => {
      const next = { ...current };
      delete next[selectedDate];
      return next;
    });
    setDraftWorkout(buildEmptyWorkout(selectedDate));
    setSelectedExerciseId(exerciseDb[0].id);
  }

  function copyPreviousWeek() {
    setSchedule((current) => {
      const next = { ...current };

      weekDays.forEach((day) => {
        if (isPastDate(day.iso)) {
          return;
        }

        const sourceIso = addDays(day.iso, -7);
        const sourceWorkout = current[sourceIso];
        if (sourceWorkout) {
          next[day.iso] = cloneWorkout({
            ...sourceWorkout,
            id: day.iso,
            date: day.iso,
          });
        }
      });

      const selectedWorkout = next[selectedDate];
      if (selectedWorkout) {
        setDraftWorkout(cloneWorkout(selectedWorkout));
        setSelectedExerciseId(selectedWorkout.exercises[0]?.exerciseId ?? exerciseDb[0].id);
        setPlannerOpen(true);
      }

      return next;
    });
  }

  function updateDraftWorkout(patch: Partial<PlanDay>) {
    if (selectedDateReadOnly) {
      return;
    }

    setDraftWorkout((current) => {
      const next = { ...current, ...patch };
      persistWorkout(next);
      return next;
    });
  }

  function startWorkout(dayId: string) {
    const day =
      dayId === selectedDate ? draftWorkout : schedule[dayId] ?? buildEmptyWorkout(dayId);
    if (day.rest || day.exercises.length === 0) {
      return;
    }
    const entries = day.exercises.map((item) => ({
      exerciseId: item.exerciseId,
      sets: createSets(item),
    }));
    const startedAt = Date.now();

    setActiveWorkout({
      dayId,
      startedAt,
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'set',
      restTargetSeconds: day.exercises[0]?.restSeconds ?? 90,
      entries,
    });
    setNowTick(startedAt);
    setSelectedDate(dayId);
    setDraftWorkout(cloneWorkout(day));
    setSelectedExerciseId(day.exercises[0].exerciseId);
    setTab('workout');
  }

  function updateCurrentSet(patch: Partial<WorkoutSet>) {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        entries: current.entries.map((entry, entryIndex) =>
          entryIndex === current.exerciseIndex
            ? {
                ...entry,
                sets: entry.sets.map((set, setIndex) =>
                  setIndex === current.setIndex ? { ...set, ...patch } : set,
                ),
              }
            : entry,
        ),
      };
    });
  }

  function completeSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      const day =
        current.dayId === selectedDate ? draftWorkout : schedule[current.dayId] ?? buildEmptyWorkout(current.dayId);
      const planned = day.exercises[current.exerciseIndex];
      const entries = current.entries.map((entry, entryIndex) =>
        entryIndex === current.exerciseIndex
          ? {
              ...entry,
              sets: entry.sets.map((set, setIndex) =>
                setIndex === current.setIndex ? { ...set, done: true } : set,
              ),
            }
          : entry,
      );

      const isLastSet = current.setIndex >= entries[current.exerciseIndex].sets.length - 1;
      const isLastExercise = current.exerciseIndex >= entries.length - 1;

      if (isLastSet && isLastExercise) {
        return { ...current, entries, phase: 'complete' };
      }

      if (isLastSet) {
        return { ...current, entries, phase: 'between' };
      }

      return {
        ...current,
        entries,
        phase: 'rest',
        restTargetSeconds: planned?.restSeconds ?? 90,
        restStartedAt: Date.now(),
      };
    });
  }

  function nextSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        setIndex: current.setIndex + 1,
        phase: 'set',
        restStartedAt: undefined,
      };
    });
  }

  function nextExercise() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      const day =
        current.dayId === selectedDate ? draftWorkout : schedule[current.dayId] ?? buildEmptyWorkout(current.dayId);
      const nextExerciseIndex = current.exerciseIndex + 1;
      const nextExerciseId = current.entries[nextExerciseIndex]?.exerciseId;

      if (nextExerciseId) {
        setSelectedExerciseId(nextExerciseId);
      }

      return {
        ...current,
        exerciseIndex: nextExerciseIndex,
        setIndex: 0,
        phase: 'set',
        restStartedAt: undefined,
        restTargetSeconds:
          day.exercises[nextExerciseIndex]?.restSeconds ?? current.restTargetSeconds,
      };
    });
  }

  function addCurrentSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      const activeEntry = current.entries[current.exerciseIndex];
      const currentSet = activeEntry.sets[current.setIndex] ?? activeEntry.sets[activeEntry.sets.length - 1];
      const nextSet: WorkoutSet = {
        id: `set-${activeEntry.sets.length + 1}`,
        targetReps: currentSet?.targetReps ?? 10,
        reps: currentSet?.reps ?? 10,
        weightKg: currentSet?.weightKg ?? 0,
        done: false,
        note: '',
      };

      return {
        ...current,
        phase: 'set',
        restStartedAt: undefined,
        setIndex: activeEntry.sets.length,
        entries: current.entries.map((entry, entryIndex) =>
          entryIndex === current.exerciseIndex
            ? { ...entry, sets: [...entry.sets, nextSet] }
            : entry,
        ),
      };
    });
  }

  function finishWorkout() {
    if (!activeWorkout) {
      return;
    }

    const volumeKg = activeWorkout.entries.reduce((total, entry) => {
      return total + entry.sets.reduce((sum, set) => sum + (set.done ? set.reps * set.weightKg : 0), 0);
    }, 0);
    const workoutDate = activeWorkout.dayId;
    const workoutPlan =
      activeWorkout.dayId === selectedDate
        ? draftWorkout
        : schedule[workoutDate] ?? buildEmptyWorkout(workoutDate);

    setLogs((current) => [
      {
        id: `log-${Date.now()}`,
        dayId: activeWorkout.dayId,
        date: workoutDate,
        volumeKg,
        durationSeconds: Math.max(0, Math.floor((Date.now() - activeWorkout.startedAt) / 1000)),
        entries: activeWorkout.entries,
      },
      ...current.filter((log) => !(log.dayId === activeWorkout.dayId && log.date === workoutDate)),
    ]);
    setSchedule((current) => ({
      ...current,
      [workoutDate]: cloneWorkout({ ...workoutPlan, id: workoutDate, date: workoutDate }),
    }));
    setActiveWorkout(null);
    setTab('calendar');
  }

  function cancelActiveWorkout() {
    setActiveWorkout(null);
    setTab('today');
  }

  function updatePlanExercise(exerciseId: string, patch: Partial<PlanExercise>) {
    if (selectedDateReadOnly) {
      return;
    }

    setDraftWorkout((current) => {
      const next = {
        ...current,
        exercises: current.exercises.map((item) =>
          item.exerciseId === exerciseId ? { ...item, ...patch } : item,
        ),
      };
      persistWorkout(next);
      return next;
    });
  }

  function addExerciseToDay(exerciseId: string) {
    if (selectedDateReadOnly) {
      return;
    }

    setDraftWorkout((current) => {
      const next = {
        ...current,
        exercises: [
          ...current.exercises,
          { exerciseId, sets: 3, reps: 10, weightKg: 30, restSeconds: 90 },
        ],
      };
      persistWorkout(next);
      return next;
    });
    setSelectedExerciseId(exerciseId);
  }

  function removeExerciseFromDay(exerciseId: string) {
    if (selectedDateReadOnly) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const fallbackExerciseId =
      draftWorkout.exercises.find((item) => item.exerciseId !== exerciseId)?.exerciseId ?? exerciseDb[0].id;

    setDraftWorkout((current) => {
      const next = {
        ...current,
        exercises: current.exercises.filter((item) => item.exerciseId !== exerciseId),
      };
      persistWorkout(next);
      return next;
    });

    if (selectedExerciseId === exerciseId) {
      setSelectedExerciseId(fallbackExerciseId);
    }
  }

  function moveExerciseInDay(exerciseId: string, direction: -1 | 1) {
    if (selectedDateReadOnly) {
      return;
    }

    setDraftWorkout((current) => {
      const fromIndex = current.exercises.findIndex((item) => item.exerciseId === exerciseId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.exercises.length) {
        return current;
      }

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const nextExercises = [...current.exercises];
      const [moved] = nextExercises.splice(fromIndex, 1);
      nextExercises.splice(toIndex, 0, moved);

      const next = { ...current, exercises: nextExercises };
      persistWorkout(next);
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <BackgroundLines />

        <View style={styles.header}>
          <View style={styles.logoFrame}>
            <Image source={hamsterLogo} style={styles.logo} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{screenTitle(tab)}</Text>
          </View>
          {activeWorkout ? (
            <View style={styles.headerClock}>
              <Text style={styles.badgeLabel}>workout</Text>
              <Text style={styles.headerClockText}>{formatTime(activeWorkoutElapsed)}</Text>
            </View>
          ) : (
            <View style={styles.badge}>
              <Text style={styles.badgeValue}>{logs.length}</Text>
              <Text style={styles.badgeLabel}>workouts</Text>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'today' ? (
            <TodayScreen
              day={todayDay}
              done={logs.some((log) => log.date === todayIso)}
              activeWorkoutLabel={activeDay?.label ?? null}
              activeWorkoutElapsed={activeWorkoutElapsed}
              hasActiveWorkout={Boolean(activeWorkout)}
              onStart={() => startWorkout(todayDay.id)}
              onResume={() => setTab('workout')}
              onCancelWorkout={cancelActiveWorkout}
              onOpenPlan={() => openDateInPlan(defaultPlanDate)}
            />
          ) : null}

          {tab === 'library' ? (
            <LibraryScreen
              selectedExercise={selectedExercise}
              level={level}
              onSelectExercise={setSelectedExerciseId}
              onLevel={setLevel}
            />
          ) : null}

          {tab === 'calendar' ? (
            <CalendarScreen
              weekDays={weekDays}
              plannerOpen={plannerOpen}
              weekOffset={weekOffset}
              selectedDate={selectedDate}
              selectedDay={selectedDay}
              selectedExercise={selectedExercise}
              readOnly={selectedDateReadOnly}
              selectedMuscleFilter={selectedMuscleFilter}
              onSelectDate={openDateInPlan}
              onPreviousWeek={() => shiftWeek(-1)}
              onNextWeek={() => shiftWeek(1)}
              onClearWorkout={clearSelectedWorkout}
              onCopyPreviousWeek={copyPreviousWeek}
              onTitleChange={(label) => updateDraftWorkout({ label })}
              onSelectExercise={setSelectedExerciseId}
              onStart={startWorkout}
              onUpdate={updatePlanExercise}
              onAddExercise={addExerciseToDay}
              onRemoveExercise={removeExerciseFromDay}
              onMoveExercise={moveExerciseInDay}
              onMuscleFilter={setSelectedMuscleFilter}
            />
          ) : null}

          {tab === 'profile' ? (
            <ProfileScreen logs={logs} schedule={schedule} />
          ) : null}

          {tab === 'workout' && activeWorkout ? (
            <WorkoutScreen
              workout={activeWorkout}
              now={nowTick}
              day={
                activeWorkout.dayId === selectedDate
                  ? draftWorkout
                  : schedule[activeWorkout.dayId] ?? buildEmptyWorkout(activeWorkout.dayId)
              }
              onUpdateSet={updateCurrentSet}
              onCompleteSet={completeSet}
              onNextSet={nextSet}
              onNextExercise={nextExercise}
              onAddSet={addCurrentSet}
              onFinish={finishWorkout}
              onCancel={() => {
                setTab('today');
              }}
            />
          ) : null}
        </ScrollView>

        {tab !== 'workout' ? (
          <View style={styles.tabBar}>
            {tabs.map((item) => {
              const active = tab === item.key;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[styles.tabButton, active ? styles.tabActive : null]}
                >
                  <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function TodayScreen({
  day,
  done,
  activeWorkoutLabel,
  activeWorkoutElapsed,
  hasActiveWorkout,
  onStart,
  onResume,
  onCancelWorkout,
  onOpenPlan,
}: {
  day: PlanDay;
  done: boolean;
  activeWorkoutLabel: string | null;
  activeWorkoutElapsed: number;
  hasActiveWorkout: boolean;
  onStart: () => void;
  onResume: () => void;
  onCancelWorkout: () => void;
  onOpenPlan: () => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>
          {hasActiveWorkout ? 'Live workout' : day.rest ? 'Rest day' : done ? 'Completed today' : 'Today'}
        </Text>
        <Text style={styles.heroTitle}>{hasActiveWorkout ? activeWorkoutLabel ?? 'Workout' : day.label}</Text>
        <Text style={styles.heroSub}>{formatDateLabel(todayIso)}</Text>
        <View style={styles.quickStats}>
          <Stat label="Exercises" value={`${day.exercises.length}`} />
          <Stat label="Status" value={hasActiveWorkout ? 'Live' : day.exercises.length > 0 ? 'Planned' : 'Empty'} />
          <Stat label={hasActiveWorkout ? 'Time' : 'Rest'} value={hasActiveWorkout ? formatTime(activeWorkoutElapsed) : day.rest ? '-' : '90s'} />
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
        ) : day.rest ? null : (
          <Pressable style={styles.primaryWide} onPress={onStart}>
            <Text style={styles.primaryText}>{done ? 'START AGAIN' : 'START WORKOUT'}</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.secondaryFull} onPress={onOpenPlan}>
        <Text style={styles.secondaryText}>Plan tomorrow</Text>
      </Pressable>
    </View>
  );
}

function PlanScreen({
  selectedDate,
  selectedDay,
  selectedExercise,
  readOnly,
  onTitleChange,
  onSelectExercise,
  onStart,
  onUpdate,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  selectedMuscleFilter,
  onMuscleFilter,
}: {
  selectedDate: string;
  selectedDay: PlanDay;
  selectedExercise: Exercise;
  readOnly: boolean;
  onTitleChange: (label: string) => void;
  onSelectExercise: (exerciseId: string) => void;
  onStart: (dayId: string) => void;
  onUpdate: (exerciseId: string, patch: Partial<PlanExercise>) => void;
  onAddExercise: (exerciseId: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, direction: -1 | 1) => void;
  selectedMuscleFilter: string;
  onMuscleFilter: (muscle: string) => void;
}) {
  const availableExercises = exerciseDb.filter(
    (exercise) =>
      !selectedDay.exercises.some((item) => item.exerciseId === exercise.id) &&
      (selectedMuscleFilter === 'All' || primaryMuscle(exercise.muscle) === selectedMuscleFilter),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.eyebrow}>{formatDateLabel(selectedDate)}</Text>
          <Text style={styles.cardTitle}>{readOnly ? selectedDay.label : 'Plan workout'}</Text>
          <Text style={styles.rowMuted}>
            {readOnly ? 'Past days are locked.' : 'Name it and add exercises. Changes save automatically.'}
          </Text>
        </View>
        <Text style={styles.planMeta}>{selectedDay.exercises.length}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.exerciseDetailTitle}>
          <Text style={styles.eyebrow}>Workout name</Text>
          {readOnly ? (
            <Text style={styles.cardTitle}>{selectedDay.label}</Text>
          ) : (
            <TextInput
              value={selectedDay.label}
              onChangeText={onTitleChange}
              placeholder="e.g. Heavy push, Back day, Legs"
              placeholderTextColor="#71717A"
              style={styles.textInput}
            />
          )}
        </View>

        {readOnly ? (
          <Text style={styles.compactText}>
            This date is read-only. You can review what was planned or logged, but you cannot edit past days.
          </Text>
        ) : null}
        {!readOnly ? <Text style={styles.compactText}>Changes are saved to this date automatically.</Text> : null}
        {selectedDay.exercises.length === 0 ? (
          <Text style={styles.compactText}>No workout planned for this date.</Text>
        ) : null}

        <View style={styles.exerciseList}>
          {selectedDay.exercises.map((item, index) => {
            const exercise = getExercise(item.exerciseId);

            return (
              <View key={`${item.exerciseId}-${index}`} style={styles.exerciseBlock}>
                <View style={[styles.exerciseRow, selectedExercise.id === exercise.id ? styles.exerciseActive : null]}>
                  <Pressable style={styles.exerciseSelectArea} onPress={() => onSelectExercise(exercise.id)}>
                    <View style={styles.exerciseNumber}>
                      <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseBody}>
                      <Text style={styles.rowTitle}>{exercise.name}</Text>
                      <Text style={styles.rowMuted}>
                        {item.sets} x {item.reps} / {item.weightKg} kg
                      </Text>
                    </View>
                    <Text style={styles.rowValue}>{exercise.muscle}</Text>
                  </Pressable>
                  {!readOnly ? (
                    <>
                      <ReorderHandle
                        canMoveUp={index > 0}
                        canMoveDown={index < selectedDay.exercises.length - 1}
                        onMove={(direction) => onMoveExercise(item.exerciseId, direction)}
                      />
                      <Pressable
                        accessibilityLabel={`Remove ${exercise.name}`}
                        style={styles.iconRemoveButton}
                        onPress={() => onRemoveExercise(item.exerciseId)}
                      >
                        <Text style={styles.iconRemoveText}>x</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
                <PlanExerciseEditor
                  item={item}
                  readOnly={readOnly}
                  onChange={(patch) => onUpdate(item.exerciseId, patch)}
                />
              </View>
            );
          })}
        </View>

        {selectedDay.exercises.length > 0 ? (
          <Pressable
            disabled={readOnly || selectedDay.rest}
            style={[styles.primaryWide, readOnly || selectedDay.rest ? styles.disabledButton : null]}
            onPress={() => onStart(selectedDay.id)}
          >
            <Text style={styles.primaryText}>START WORKOUT</Text>
          </Pressable>
        ) : null}
      </View>

      {!readOnly ? (
        <>
          <Section title="Add exercise" />
          <View style={styles.chipRow}>
            {muscleFilters.map((muscle) => (
              <Pressable
                key={muscle}
                style={[styles.chip, selectedMuscleFilter === muscle ? styles.chipActive : null]}
                onPress={() => onMuscleFilter(muscle)}
              >
                <Text style={styles.chipText}>{muscle}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.libraryList}>
            {availableExercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                style={styles.libraryRow}
                onPress={() => onAddExercise(exercise.id)}
              >
                <Text style={styles.rowTitle}>{exercise.name}</Text>
                <Text style={styles.rowValue}>{exercise.muscle}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function PlanExerciseEditor({
  item,
  readOnly,
  onChange,
}: {
  item: PlanExercise;
  readOnly: boolean;
  onChange: (patch: Partial<PlanExercise>) => void;
}) {
  if (readOnly) {
    return (
      <View style={styles.planEditor}>
        <View style={styles.stepperRow}>
          <ReadonlyMetric label="Sets" value={`${item.sets}`} />
          <ReadonlyMetric label="Reps" value={`${item.reps}`} />
          <ReadonlyMetric label="Kg" value={`${item.weightKg}`} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.planEditor}>
      <View style={styles.stepperRow}>
        <Stepper label="Sets" value={`${item.sets}`} onMinus={() => onChange({ sets: Math.max(1, item.sets - 1) })} onPlus={() => onChange({ sets: item.sets + 1 })} />
        <Stepper label="Reps" value={`${item.reps}`} onMinus={() => onChange({ reps: Math.max(1, item.reps - 1) })} onPlus={() => onChange({ reps: item.reps + 1 })} />
        <Stepper label="Kg" value={`${item.weightKg}`} onMinus={() => onChange({ weightKg: Math.max(0, item.weightKg - 2.5) })} onPlus={() => onChange({ weightKg: item.weightKg + 2.5 })} />
      </View>
    </View>
  );
}

function ReorderHandle({
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -24 && canMoveUp) {
          onMove(-1);
        }

        if (gesture.dy > 24 && canMoveDown) {
          onMove(1);
        }
      },
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel="Drag to reorder exercise"
      style={[styles.dragHandle, !canMoveUp && !canMoveDown ? styles.disabledButton : null]}
    >
      <Text style={styles.dragHandleText}>::</Text>
    </View>
  );
}

function ReadonlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.readonlyMetric}>
        <Text style={styles.stepperValue}>{value}</Text>
      </View>
    </View>
  );
}

function WorkoutScreen({
  workout,
  now,
  day,
  onUpdateSet,
  onCompleteSet,
  onNextSet,
  onNextExercise,
  onAddSet,
  onFinish,
  onCancel,
}: {
  workout: ActiveWorkout;
  now: number;
  day: PlanDay;
  onUpdateSet: (patch: Partial<WorkoutSet>) => void;
  onCompleteSet: () => void;
  onNextSet: () => void;
  onNextExercise: () => void;
  onAddSet: () => void;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const entry = workout.entries[workout.exerciseIndex];
  const exercise = getExercise(entry.exerciseId);
  const currentSet = entry.sets[workout.setIndex];
  const upcomingSet = entry.sets[Math.min(workout.setIndex + 1, entry.sets.length - 1)];
  const nextEntry = workout.entries[workout.exerciseIndex + 1];
  const nextExercise = nextEntry ? getExercise(nextEntry.exerciseId) : null;
  const workoutElapsed = Math.max(0, Math.floor((now - workout.startedAt) / 1000));
  const restElapsed =
    workout.phase === 'rest'
      ? Math.floor((now - (workout.restStartedAt ?? now)) / 1000)
      : 0;
  const restRemaining = workout.restTargetSeconds - restElapsed;

  if (workout.phase === 'complete') {
    return (
      <View style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Workout complete</Text>
          <Text style={styles.heroTitle}>{day.label}</Text>
          <Text style={styles.heroSub}>Total time {formatTime(workoutElapsed)}. Save the result to your training history.</Text>
          <Pressable style={styles.primaryWide} onPress={onFinish}>
            <Text style={styles.primaryText}>SAVE WORKOUT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (workout.phase === 'between') {
    return (
      <View style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Exercise complete</Text>
          <Text style={styles.heroTitle}>{exercise.name}</Text>
          <Text style={styles.heroSub}>Next exercise: {nextExercise?.name}</Text>
          <Pressable style={styles.primaryWide} onPress={onNextExercise}>
            <Text style={styles.primaryText}>CONTINUE</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.workoutTop}>
        <Pressable style={styles.backButton} onPress={onCancel}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.eyebrow}>{exercise.name}</Text>
        <View style={styles.timerCircle}>
          {workout.phase === 'rest' ? (
            <>
              <Text style={[styles.timerMain, restRemaining < 0 ? styles.timerOvertime : null]}>
                {formatSignedTime(restRemaining)}
              </Text>
              <Text style={styles.timerSub}>
                rest / target {formatTime(workout.restTargetSeconds)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.timerMain}>{currentSet.weightKg} kg</Text>
              <Text style={styles.timerSub}>{currentSet.reps} reps</Text>
            </>
          )}
        </View>
        <Text style={styles.heroSub}>
          Set {workout.setIndex + 1} / {entry.sets.length}
        </Text>
      </View>

      {workout.phase === 'set' ? (
        <View style={styles.card}>
          <View style={styles.stepperRow}>
            <Stepper label="Reps" value={`${currentSet.reps}`} onMinus={() => onUpdateSet({ reps: Math.max(0, currentSet.reps - 1) })} onPlus={() => onUpdateSet({ reps: currentSet.reps + 1 })} />
            <Stepper label="Kg" value={`${currentSet.weightKg}`} onMinus={() => onUpdateSet({ weightKg: Math.max(0, currentSet.weightKg - 2.5) })} onPlus={() => onUpdateSet({ weightKg: currentSet.weightKg + 2.5 })} />
          </View>
          <TextInput
            value={currentSet.note ?? ''}
            onChangeText={(note) => onUpdateSet({ note })}
            placeholder="Set note, substitution, pain, extra context"
            placeholderTextColor="#71717A"
            style={styles.noteInput}
            multiline
          />
          <Pressable style={styles.secondaryFull} onPress={onAddSet}>
            <Text style={styles.secondaryText}>Add extra set</Text>
          </Pressable>
          <Pressable style={styles.primaryWide} onPress={onCompleteSet}>
            <Text style={styles.primaryText}>SET DONE</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next set</Text>
          <Text style={styles.compactText}>
            {upcomingSet.targetReps} reps / {upcomingSet.weightKg} kg
          </Text>
          <Pressable style={styles.primaryWide} onPress={onNextSet}>
            <Text style={styles.primaryText}>NEXT SET</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function LibraryScreen({
  selectedExercise,
  level,
  onSelectExercise,
  onLevel,
}: {
  selectedExercise: Exercise;
  level: Level;
  onSelectExercise: (exerciseId: string) => void;
  onLevel: (level: Level) => void;
}) {
  const [libraryFilter, setLibraryFilter] = useState('All');
  const visibleExercises = exerciseDb.filter(
    (exercise) => libraryFilter === 'All' || primaryMuscle(exercise.muscle) === libraryFilter,
  );

  return (
    <View style={styles.screen}>
      <View style={styles.libraryDetailCard}>
        <View style={styles.libraryHeroTop}>
          <View style={styles.exerciseDetailTitle}>
            <Text style={styles.eyebrow}>Selected exercise</Text>
            <Text style={styles.cardTitle}>{selectedExercise.name}</Text>
            <View style={styles.metaPillRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{selectedExercise.muscle}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{selectedExercise.equipment}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.toggle}>
          <Pressable style={[styles.toggleItem, level === 'simple' ? styles.toggleActive : null]} onPress={() => onLevel('simple')}>
            <Text style={level === 'simple' ? styles.toggleTextActive : styles.toggleText}>Basic</Text>
          </Pressable>
          <Pressable style={[styles.toggleItem, level === 'technical' ? styles.toggleActive : null]} onPress={() => onLevel('technical')}>
            <Text style={level === 'technical' ? styles.toggleTextActive : styles.toggleText}>Detail</Text>
          </Pressable>
        </View>

        <View style={styles.descriptionBox}>
          <View style={styles.descriptionHeader}>
            <Text style={styles.descriptionLabel}>Coach notes</Text>
          </View>
          <Text style={styles.descriptionText}>
            {level === 'simple' ? selectedExercise.simple : selectedExercise.technical}
          </Text>
        </View>
      </View>

      <Section title="Find exercise" />
      <View style={styles.chipRow}>
        {muscleFilters.map((muscle) => (
          <Pressable
            key={muscle}
            style={[styles.chip, libraryFilter === muscle ? styles.chipActive : null]}
            onPress={() => setLibraryFilter(muscle)}
          >
            <Text style={styles.chipText}>{muscle}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.libraryList}>
        {visibleExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={[styles.libraryRow, selectedExercise.id === exercise.id ? styles.libraryRowActive : null]}
            onPress={() => onSelectExercise(exercise.id)}
          >
            <Text style={styles.rowTitle}>{exercise.name}</Text>
            <Text style={styles.rowValue}>{exercise.muscle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CalendarScreen({
  weekDays,
  plannerOpen,
  weekOffset,
  selectedDate,
  selectedDay,
  selectedExercise,
  readOnly,
  selectedMuscleFilter,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
  onClearWorkout,
  onCopyPreviousWeek,
  onTitleChange,
  onSelectExercise,
  onStart,
  onUpdate,
  onAddExercise,
  onRemoveExercise,
  onMoveExercise,
  onMuscleFilter,
}: {
  weekDays: CalendarDay[];
  plannerOpen: boolean;
  weekOffset: number;
  selectedDate: string;
  selectedDay: PlanDay;
  selectedExercise: Exercise;
  readOnly: boolean;
  selectedMuscleFilter: string;
  onSelectDate: (iso: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onClearWorkout: () => void;
  onCopyPreviousWeek: () => void;
  onTitleChange: (label: string) => void;
  onSelectExercise: (exerciseId: string) => void;
  onStart: (dayId: string) => void;
  onUpdate: (exerciseId: string, patch: Partial<PlanExercise>) => void;
  onAddExercise: (exerciseId: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onMoveExercise: (exerciseId: string, direction: -1 | 1) => void;
  onMuscleFilter: (muscle: string) => void;
}) {
  const selectedDayHasWorkout = selectedDay.exercises.length > 0 || selectedDay.label !== 'New workout';
  const headerIso = weekDays[0]?.iso ?? todayIso;

  return (
    <View style={styles.screen}>
      <View style={styles.weekHeader}>
        <Pressable style={styles.iconButton} onPress={onPreviousWeek}>
          <Text style={styles.iconButtonText}>‹</Text>
        </Pressable>
        <View style={styles.weekHeaderCenter}>
          <Text style={styles.calendarMonth}>
            {getMonthLabel(headerIso)}
          </Text>
          <Text style={styles.calendarHint}>
            {weekOffset === 0 ? 'This week' : weekOffset > 0 ? `+${weekOffset} week` : `${weekOffset} week`}
          </Text>
        </View>
        <Pressable style={styles.iconButton} onPress={onNextWeek}>
          <Text style={styles.iconButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekSchedule}>
        {weekDays.map((day, index) => (
          <Pressable
            key={`week-${day.iso}`}
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
            <Text style={styles.calendarPlan}>{day.planDay?.label ?? 'Plan'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.editorActions}>
        <Pressable style={styles.reorderButton} onPress={onCopyPreviousWeek}>
          <Text style={styles.reorderText}>Copy last week</Text>
        </Pressable>
        <Pressable
          disabled={readOnly || !selectedDayHasWorkout}
          style={[styles.removeButton, readOnly || !selectedDayHasWorkout ? styles.disabledButton : null]}
          onPress={onClearWorkout}
        >
          <Text style={styles.removeButtonText}>Clear day</Text>
        </Pressable>
      </View>

      {plannerOpen ? (
        <PlanScreen
          selectedDate={selectedDate}
          selectedDay={selectedDay}
          selectedExercise={selectedExercise}
          readOnly={readOnly}
          selectedMuscleFilter={selectedMuscleFilter}
          onMuscleFilter={onMuscleFilter}
          onTitleChange={onTitleChange}
          onSelectExercise={onSelectExercise}
          onStart={onStart}
          onUpdate={onUpdate}
          onAddExercise={onAddExercise}
          onRemoveExercise={onRemoveExercise}
          onMoveExercise={onMoveExercise}
        />
      ) : null}
    </View>
  );
}

function ProfileScreen({
  logs,
  schedule,
}: {
  logs: WorkoutLog[];
  schedule: Record<string, PlanDay>;
}) {
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

      <Section title="History" />
      {logs.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.compactText}>No saved workouts yet.</Text>
        </View>
      ) : null}
      <View style={styles.libraryList}>
        {logs.map((log) => {
          const day = schedule[log.date];
          const doneSets = log.entries.reduce(
            (sum, entry) => sum + entry.sets.filter((set) => set.done).length,
            0,
          );

          return (
            <View key={log.id} style={styles.historyLogCard}>
              <View style={styles.rowBetween}>
                <View style={styles.exerciseDetailTitle}>
                  <Text style={styles.rowTitle}>{day?.label ?? 'Workout'}</Text>
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

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepperButton} onPress={onMinus}>
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable style={styles.stepperButton} onPress={onPlus}>
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BackgroundLines() {
  return (
    <View pointerEvents="none" style={styles.background}>
      <View style={styles.bgLineOne} />
      <View style={styles.bgLineTwo} />
      <View style={styles.bgLineThree} />
    </View>
  );
}
