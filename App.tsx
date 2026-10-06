import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { hamsterLogo } from './src/assets';
import { BackgroundLines } from './src/components/ui';
import { exerciseDb } from './src/data/exercises';
import {
  addDays,
  buildWeekDays,
  createSets,
  formatTime,
  getExercise,
  screenTitle,
  tabs,
  todayIso,
} from './src/data/plans';
import { styles } from './src/theme/styles';
import {
  advanceToNextExercise,
  advanceToNextSet,
  appendSetToCurrentExercise,
  adjustRestTimer,
  calculateWorkoutVolume,
  completeCurrentSet,
  findPreviousExercisePerformance,
  getRestTimerRemaining,
  pauseRestTimer,
  resumeRestTimer,
  toggleSupersetWithNext,
} from './src/domain/workouts';
import {
  CustomExerciseInput,
  createCustomExercise,
  updateCustomExercise,
} from './src/domain/exercises';
import {
  addExerciseToTemplate,
  createWorkoutTemplate,
  duplicateWorkoutTemplate,
  getNextWorkoutTemplate,
  moveExerciseInTemplate,
  removeExerciseFromTemplate,
  templateToPlanDay,
  updateTemplateExercise,
  updateWorkoutTemplateDetails,
} from './src/domain/templates';
import { calculatePersonalRecords } from './src/domain/progress';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { WorkoutRestDock, WorkoutScreen } from './src/screens/WorkoutScreen';
import { trainingRepository } from './src/storage/trainingRepository';
import {
  ActiveWorkout,
  Exercise,
  Level,
  PlanDay,
  TabKey,
  TemplateExercise,
  WorkoutLog,
  WorkoutSet,
  WorkoutTemplate,
} from './src/types';

const localUserId = 'local-user';

export default function App() {
  const [tab, setTab] = useState<TabKey>('today');
  const [schedule, setSchedule] = useState<Record<string, PlanDay>>({});
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseDb[0].id);
  const [weekOffset, setWeekOffset] = useState(0);
  const [level, setLevel] = useState<Level>('simple');
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const exercises = useMemo(() => [...exerciseDb, ...customExercises], [customExercises]);
  const selectedExercise = getExercise(selectedExerciseId, exercises);
  const weekDays = buildWeekDays(logs, weekOffset);
  const selectedLogs = logs
    .filter((log) => log.date === selectedDate)
    .sort((left, right) => right.startedAt - left.startedAt);
  const todayLogs = logs
    .filter((log) => log.date === todayIso)
    .sort((left, right) => right.startedAt - left.startedAt);
  const activeWorkoutElapsed = activeWorkout
    ? Math.max(0, Math.floor((nowTick - activeWorkout.startedAt) / 1000))
    : 0;
  const activePreviousSets = activeWorkout
    ? findPreviousExercisePerformance(
        logs,
        activeWorkout.userId,
        activeWorkout.entries[activeWorkout.exerciseIndex]?.exerciseId ?? '',
        activeWorkout.startedAt,
      )
    : null;
  const activePersonalRecords = activeWorkout
    ? calculatePersonalRecords(activeWorkout.entries, logs, activeWorkout.userId)
    : [];
  const nextTemplate = getNextWorkoutTemplate(
    templates.filter((template) => template.exercises.length > 0),
    logs,
    localUserId,
  );
  const nextTemplateLastLog = nextTemplate
    ? [...logs]
        .filter((log) => log.templateId === nextTemplate.id && log.userId === localUserId)
        .sort((left, right) => right.finishedAt - left.finishedAt)[0] ?? null
    : null;

  useEffect(() => {
    let mounted = true;

    async function loadStoredTraining() {
      try {
        const stored = await trainingRepository.load();
        if (!mounted || !stored) {
          return;
        }

        const restoredWorkout = stored.activeWorkout;

        setSchedule(stored.schedule);
        setLogs(stored.logs);
        setCustomExercises(stored.customExercises);
        setTemplates(stored.templates);
        setActiveWorkout(restoredWorkout);
        setSelectedDate(todayIso);
        setSelectedExerciseId(
          restoredWorkout?.entries[restoredWorkout.exerciseIndex]?.exerciseId ??
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

    trainingRepository.save({ schedule, logs, activeWorkout, customExercises, templates }).catch(() => {
      // Local persistence failure should not block workout tracking.
    });
  }, [activeWorkout, customExercises, logs, schedule, storageReady, templates]);

  useEffect(() => {
    if (!activeWorkout) {
      return;
    }

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [activeWorkout]);

  useEffect(() => {
    if (
      !activeWorkout ||
      activeWorkout.phase !== 'rest' ||
      getRestTimerRemaining(activeWorkout, nowTick) > 0
    ) {
      return;
    }

    setActiveWorkout((current) => current ? advanceToNextSet(current) : current);
  }, [activeWorkout, nowTick]);

  function shiftWeek(direction: -1 | 1) {
    setWeekOffset((current) => current + direction);
    setSelectedDate((current) => addDays(current, direction * 7));
  }

  function beginWorkout(day: PlanDay, templateId?: string) {
    if (activeWorkout) {
      setTab('workout');
      return;
    }

    if (day.rest || day.exercises.length === 0) {
      return;
    }
    const startedAt = Date.now();
    const entries = day.exercises.map((item) => {
      const workoutExerciseId = createLocalId('workout-exercise');
      const previousSets = findPreviousExercisePerformance(
        logs,
        localUserId,
        item.exerciseId,
        startedAt,
      );

      return {
        id: workoutExerciseId,
        exerciseId: item.exerciseId,
        restSeconds: item.restSeconds,
        sets: createSets(item, {
          workoutExerciseId,
          setIds: Array.from({ length: item.sets }, () => createLocalId('set')),
          createdAt: startedAt,
          previousSets,
        }),
      };
    });

    setActiveWorkout({
      id: createLocalId('session'),
      userId: localUserId,
      dayId: day.id,
      templateId,
      name: day.label,
      startedAt,
      exerciseIndex: 0,
      setIndex: 0,
      phase: 'set',
      restTargetSeconds: day.exercises[0]?.restSeconds ?? 90,
      entries,
    });
    setNowTick(startedAt);
    setSelectedDate(day.id);
    setSelectedExerciseId(day.exercises[0].exerciseId);
    setTab('workout');
  }

  function updateSetAtIndex(targetSetIndex: number, patch: Partial<WorkoutSet>) {
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
                  setIndex === targetSetIndex ? { ...set, ...patch } : set,
                ),
              }
            : entry,
        ),
      };
    });
  }

  function updateWorkoutNotes(notes: string) {
    setActiveWorkout((current) => current ? { ...current, notes } : current);
  }

  function updateExerciseNotes(notes: string) {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        entries: current.entries.map((entry, entryIndex) =>
          entryIndex === current.exerciseIndex ? { ...entry, notes } : entry,
        ),
      };
    });
  }

  function toggleCurrentSuperset() {
    setActiveWorkout((current) =>
      current
        ? toggleSupersetWithNext(current, createLocalId('superset'))
        : current,
    );
  }

  function completeSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      const restSeconds = current.entries[current.exerciseIndex]?.restSeconds;
      const completed = completeCurrentSet(
        current,
        restSeconds ?? current.restTargetSeconds,
        Date.now(),
      );
      if (completed.phase !== 'between') {
        return completed;
      }

      const nextExerciseIndex = completed.exerciseIndex + 1;
      return advanceToNextExercise(
        completed,
        completed.entries[nextExerciseIndex]?.restSeconds ?? 90,
      );
    });
  }

  function nextSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      return advanceToNextSet(current);
    });
  }

  function nextExercise() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      const nextExerciseIndex = current.exerciseIndex + 1;

      return advanceToNextExercise(
        current,
        current.entries[nextExerciseIndex]?.restSeconds ?? 90,
      );
    });
  }

  function addCurrentSet() {
    setActiveWorkout((current) => {
      if (!current) {
        return current;
      }

      return appendSetToCurrentExercise(current, {
        id: createLocalId('set'),
        createdAt: Date.now(),
      });
    });
  }

  function pauseRest() {
    setActiveWorkout((current) => current ? pauseRestTimer(current, Date.now()) : current);
  }

  function resumeRest() {
    setActiveWorkout((current) => current ? resumeRestTimer(current, Date.now()) : current);
  }

  function adjustRest(adjustmentSeconds: number) {
    setActiveWorkout((current) =>
      current ? adjustRestTimer(current, adjustmentSeconds, Date.now()) : current,
    );
  }

  function finishWorkout() {
    if (!activeWorkout) {
      return;
    }

    const volumeKg = calculateWorkoutVolume(activeWorkout.entries);
    const finishedAt = Date.now();
    const workoutDate = activeWorkout.dayId;

    setLogs((current) => [
      {
        id: activeWorkout.id,
        userId: activeWorkout.userId,
        dayId: activeWorkout.dayId,
        templateId: activeWorkout.templateId,
        name: activeWorkout.name,
        notes: activeWorkout.notes,
        date: workoutDate,
        startedAt: activeWorkout.startedAt,
        finishedAt,
        volumeKg,
        durationSeconds: Math.max(0, Math.floor((finishedAt - activeWorkout.startedAt) / 1000)),
        entries: activeWorkout.entries,
      },
      ...current,
    ]);
    setActiveWorkout(null);
    setSelectedDate(workoutDate);
    setTab('calendar');
  }

  function cancelActiveWorkout() {
    setActiveWorkout(null);
    setTab('today');
  }

  function addCustomExercise(input: CustomExerciseInput) {
    const exercise = createCustomExercise(input, {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: localUserId,
    });

    setCustomExercises((current) => [...current, exercise]);
    setSelectedExerciseId(exercise.id);
  }

  function editCustomExercise(exerciseId: string, input: CustomExerciseInput) {
    setCustomExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? updateCustomExercise(exercise, input, localUserId)
          : exercise,
      ),
    );
  }

  function addTemplate() {
    const now = Date.now();
    const template = createWorkoutTemplate(
      { name: 'New template' },
      { id: createLocalId('template'), userId: localUserId, createdAt: now },
    );
    setTemplates((current) => [...current, template]);
    return template;
  }

  function updateTemplateDetails(
    templateId: string,
    patch: { name?: string; description?: string },
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? updateWorkoutTemplateDetails(template, patch, Date.now())
          : template,
      ),
    );
  }

  function duplicateTemplate(templateId: string) {
    const source = templates.find((template) => template.id === templateId);
    if (!source) {
      throw new Error('Template not found.');
    }

    const duplicate = duplicateWorkoutTemplate(source, {
      id: createLocalId('template'),
      userId: localUserId,
      createdAt: Date.now(),
      templateExerciseIds: source.exercises.map(() => createLocalId('template-exercise')),
    });
    setTemplates((current) => [...current, duplicate]);
    return duplicate;
  }

  function addExerciseToWorkoutTemplate(templateId: string, exerciseId: string) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? addExerciseToTemplate(
              template,
              exerciseId,
              createLocalId('template-exercise'),
              Date.now(),
            )
          : template,
      ),
    );
  }

  function editWorkoutTemplateExercise(
    templateId: string,
    templateExerciseId: string,
    patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>,
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? updateTemplateExercise(template, templateExerciseId, patch, Date.now())
          : template,
      ),
    );
  }

  function removeWorkoutTemplateExercise(templateId: string, templateExerciseId: string) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? removeExerciseFromTemplate(template, templateExerciseId, Date.now())
          : template,
      ),
    );
  }

  function moveWorkoutTemplateExercise(
    templateId: string,
    templateExerciseId: string,
    direction: -1 | 1,
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId
          ? moveExerciseInTemplate(template, templateExerciseId, direction, Date.now())
          : template,
      ),
    );
  }

  function startWorkoutFromTemplate(template: WorkoutTemplate) {
    beginWorkout(templateToPlanDay(template, todayIso), template.id);
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

        <ScrollView
          contentContainerStyle={[
            styles.content,
            tab === 'workout' && activeWorkout?.phase === 'rest'
              ? styles.contentWithRestDock
              : null,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'today' ? (
            <TodayScreen
              logs={todayLogs}
              templates={templates}
              nextTemplate={nextTemplate}
              nextTemplateLastLog={nextTemplateLastLog}
              activeWorkoutLabel={activeWorkout?.name ?? null}
              activeWorkoutElapsed={activeWorkoutElapsed}
              hasActiveWorkout={Boolean(activeWorkout)}
              onStartTemplate={startWorkoutFromTemplate}
              onResume={() => setTab('workout')}
              onCancelWorkout={cancelActiveWorkout}
              onOpenPlans={() => setTab('templates')}
            />
          ) : null}

          {tab === 'library' ? (
            <LibraryScreen
              exercises={exercises}
              selectedExercise={selectedExercise}
              level={level}
              logs={logs}
              userId={localUserId}
              onSelectExercise={setSelectedExerciseId}
              onLevel={setLevel}
              onCreateCustomExercise={addCustomExercise}
              onUpdateCustomExercise={editCustomExercise}
            />
          ) : null}

          {tab === 'templates' ? (
            <TemplatesScreen
              templates={templates}
              exercises={exercises}
              onCreate={addTemplate}
              onUpdateDetails={updateTemplateDetails}
              onDuplicate={duplicateTemplate}
              onAddExercise={addExerciseToWorkoutTemplate}
              onUpdateExercise={editWorkoutTemplateExercise}
              onRemoveExercise={removeWorkoutTemplateExercise}
              onMoveExercise={moveWorkoutTemplateExercise}
              onStart={startWorkoutFromTemplate}
            />
          ) : null}

          {tab === 'calendar' ? (
            <CalendarScreen
              exercises={exercises}
              weekDays={weekDays}
              weekOffset={weekOffset}
              selectedDate={selectedDate}
              selectedLogs={selectedLogs}
              onSelectDate={setSelectedDate}
              onPreviousWeek={() => shiftWeek(-1)}
              onNextWeek={() => shiftWeek(1)}
              onOpenPlans={() => setTab('templates')}
            />
          ) : null}

          {tab === 'profile' ? (
            <ProfileScreen logs={logs} schedule={schedule} />
          ) : null}

          {tab === 'workout' && activeWorkout ? (
            <WorkoutScreen
              exercises={exercises}
              workout={activeWorkout}
              previousSets={activePreviousSets}
              personalRecords={activePersonalRecords}
              now={nowTick}
              onUpdateSetAtIndex={updateSetAtIndex}
              onUpdateWorkoutNotes={updateWorkoutNotes}
              onUpdateExerciseNotes={updateExerciseNotes}
              onCompleteSet={completeSet}
              onNextExercise={nextExercise}
              onAddSet={addCurrentSet}
              onToggleSuperset={toggleCurrentSuperset}
              onFinish={finishWorkout}
              onCancel={() => {
                setTab('today');
              }}
            />
          ) : null}
        </ScrollView>

        {tab === 'workout' && activeWorkout?.phase === 'rest' ? (
          <WorkoutRestDock
            workout={activeWorkout}
            now={nowTick}
            onPause={pauseRest}
            onResume={resumeRest}
            onAdjust={adjustRest}
            onSkip={nextSet}
          />
        ) : null}

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

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
