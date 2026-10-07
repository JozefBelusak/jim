import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { hamsterLogo } from './src/assets';
import { ConfirmationDialog } from './src/components/ConfirmationDialog';
import { registerOfflineSupport } from './src/web/offline';
import { BackupPanel } from './src/components/BackupPanel';
import { MachineMemoryPanel } from './src/components/MachineMemoryPanel';
import { SavingIndicator } from './src/components/SavingIndicator';
import { BackgroundLines } from './src/components/ui';
import { exerciseDb } from './src/data/exercises';
import { addDays, buildWeekDays, createSets, formatTime, getExercise, getTodayIso, screenTitle, tabs } from './src/data/plans';
import { addStarterTemplate, identifyStarterTemplate } from './src/data/starterTemplates';
import { CustomExerciseInput, createCustomExercise, updateCustomExercise } from './src/domain/exercises';
import { linkWorkoutMachine, saveMachineMemory } from './src/domain/machineMemory';
import { getEntryMetric, getExerciseMetric } from './src/domain/metrics';
import { calculatePersonalRecords } from './src/domain/progress';
import {
  addExerciseToTemplate, createWorkoutTemplate, duplicateWorkoutTemplate, getNextWorkoutTemplate,
  moveExerciseInTemplate, moveTemplate, removeExerciseFromTemplate, setTemplateArchived,
  templateToPlanDay, updateTemplateExercise, updateWorkoutTemplateDetails,
} from './src/domain/templates';
import {
  advanceToNextSet, adjustRestTimer, createWorkoutLog,
  findPreviousExercisePerformance, getRestTimerRemaining, getWorkoutElapsedSeconds,
  pauseRestTimer, pauseWorkout, resumeRestTimer, resumeWorkout,
} from './src/domain/workouts';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { SocialPanel } from './src/social/SocialPanel';
import { useSocialAccount } from './src/social/useSocialAccount';
import { BottomSheet } from './src/components/BottomSheet';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { TemplatesScreen } from './src/screens/TemplatesScreen';
import { WorkoutRestDock, WorkoutScreen } from './src/screens/WorkoutScreen';
import { TrainingState } from './src/storage/trainingStorage';
import { useTrainingState } from './src/storage/useTrainingState';
import { styles } from './src/theme/styles';
import { ActiveWorkout, Level, PlanDay, TabKey, TemplateExercise, WorkoutLog, WorkoutTemplate } from './src/types';

const localUserId = 'local-user';
const createLocalId = (prefix = 'item') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
type UndoAction = { label: string; apply: (state: TrainingState) => TrainingState };

export default function App() {
  const { state, setState, status, error, ready, hasConflict, importState, retrySave, reload } = useTrainingState();
  const { schedule, logs, customExercises, templates, activeWorkout } = state;
  const machineMemories = state.machineMemories ?? [];
  const scrollRef = useRef<ScrollView>(null);
  const [initialOpenLogId, setInitialOpenLogId] = useState<string | undefined>();
  const account = useSocialAccount();
  const [tab, setTab] = useState<TabKey>(() => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('profile') || new URLSearchParams(window.location.search).has('account') || window.location.hash.includes('type=recovery')) ? 'profile' : 'today');
  const [nowTick, setNowTick] = useState(Date.now);
  const today = getTodayIso(new Date(nowTick));
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseDb[0].id);
  const [weekOffset, setWeekOffset] = useState(0);
  const [level, setLevel] = useState<Level>('simple');
  const [undo, setUndo] = useState<UndoAction | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const exercises = useMemo(() => [...exerciseDb, ...customExercises], [customExercises]);
  const selectedExercise = getExercise(selectedExerciseId, exercises);
  const weekDays = buildWeekDays(logs, weekOffset, today);
  const selectedLogs = logs.filter((log) => log.date === selectedDate).sort((a, b) => b.startedAt - a.startedAt);
  const todayLogs = logs.filter((log) => log.date === today).sort((a, b) => b.startedAt - a.startedAt);
  const visibleEntry = activeWorkout?.entries.find((entry) => activeWorkout.phase === 'rest' && entry.id === activeWorkout.restNextExerciseId)
    ?? activeWorkout?.entries[activeWorkout.exerciseIndex];
  const activePreviousSets = activeWorkout && visibleEntry
    ? findPreviousExercisePerformance(logs, localUserId, visibleEntry.exerciseId, activeWorkout.startedAt, visibleEntry.machineMemoryId, getEntryMetric(visibleEntry)) : null;
  const nextTemplate = getNextWorkoutTemplate(templates.filter((template) => template.exercises.length > 0), logs, localUserId);
  const nextTemplateLastLog = nextTemplate ? [...logs].filter((log) => log.templateId === nextTemplate.id).sort((a, b) => b.finishedAt - a.finishedAt)[0] ?? null : null;

  useEffect(() => { registerOfflineSupport(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [tab]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    const refresh = () => setNowTick(Date.now());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    if (!activeWorkout || activeWorkout.phase !== 'rest' || activeWorkout.pausedAt !== undefined ||
        activeWorkout.restPausedRemainingSeconds !== undefined || getRestTimerRemaining(activeWorkout, nowTick) > 0) return;
    setState((current) => ({ ...current, activeWorkout: current.activeWorkout ? advanceToNextSet(current.activeWorkout) : null }));
  }, [activeWorkout, nowTick, setState]);

  function changeWorkout(update: (workout: ActiveWorkout) => ActiveWorkout) {
    setState((current) => ({ ...current, activeWorkout: current.activeWorkout ? update(current.activeWorkout) : null }));
  }

  function openWorkout(workout: ActiveWorkout) {
    if (activeWorkout) { setNotice('Najprv dokonči alebo zruš aktuálny tréning.'); setTab('workout'); return; }
    setState((current) => ({ ...current, activeWorkout: workout, onboardingCompleted: true }));
    setNowTick(Date.now());
    setTab('workout');
    setConfirmCancel(false);
  }

  function beginWorkout(day: PlanDay, templateId?: string) {
    if (activeWorkout) { setTab('workout'); return; }
    if (day.rest) return;
    const now = Date.now();
    const entries = day.exercises.map((item) => {
      const id = createLocalId('exercise');
      const exercise = getExercise(item.exerciseId, exercises);
      const metric = getExerciseMetric(exercise);
      const previousSets = findPreviousExercisePerformance(logs, localUserId, item.exerciseId, now, undefined, metric);
      return { id, exerciseId: item.exerciseId, metric, restSeconds: item.restSeconds, notes: item.notes,
        sets: createSets(item, { workoutExerciseId: id, setIds: Array.from({ length: item.sets }, () => createLocalId('set')), createdAt: now, previousSets })
          .map((set, index) => ({ ...set, ...(metric === 'duration' ? { durationSeconds: previousSets?.[index]?.durationSeconds ?? item.reps, reps: 0, weightKg: 0 } : {}),
            ...(metric === 'distance_duration' ? { durationSeconds: previousSets?.[index]?.durationSeconds ?? 600, distanceKm: previousSets?.[index]?.distanceKm ?? 0, reps: 0, weightKg: 0 } : {}) })) };
    });
    openWorkout({ id: createLocalId('session'), userId: localUserId, dayId: day.id, templateId, name: day.label, startedAt: now,
      exerciseIndex: 0, setIndex: 0, phase: 'set', restTargetSeconds: entries[0]?.restSeconds ?? 90, entries });
  }

  function startTemplate(template: WorkoutTemplate) { beginWorkout(templateToPlanDay(template, today), template.id); }
  function startEmpty() { beginWorkout({ id: today, date: today, label: 'Voľný tréning', focus: '', exercises: [] }); }
  function startStarter(index: number) {
    if (activeWorkout) { setTab('workout'); return; }
    startTemplate(addStarter(index));
  }
  function addStarter(index: number) {
    const result = addStarterTemplate(templates, localUserId, index, Date.now(), createLocalId);
    setState((current) => ({ ...current, templates: result.templates }));
    return result.template;
  }

  function saveWorkout() {
    if (!activeWorkout) return;
    const log = createWorkoutLog(activeWorkout, Date.now());
    if (!log.entries.some((entry) => entry.sets.length > 0)) { setNotice('Najprv odcvič aspoň jednu sériu, alebo zruš prázdny tréning.'); return; }
    setState((current) => ({ ...current, logs: [log, ...current.logs.filter((existing) => existing.id !== log.id)], activeWorkout: null }));
    setSelectedDate(log.date);
    setTab('calendar');
    setNotice('Tréning bol dokončený. Stav uloženia vidíš hore.');
  }

  function discardWorkout() {
    if (!activeWorkout) return;
    const cancelled = pauseWorkout(activeWorkout, Date.now());
    setUndo({ label: 'Tréning bol zrušený', apply: (current) => current.activeWorkout ? current : { ...current, activeWorkout: resumeWorkout(cancelled, Date.now()) } });
    setState((current) => ({ ...current, activeWorkout: null }));
    setConfirmCancel(false);
    setTab('today');
  }

  function repeatWorkout(log: WorkoutLog) {
    const now = Date.now();
    const entries = log.entries.filter((entry) => entry.sets.some((set) => set.done)).map((entry) => {
      const id = createLocalId('exercise');
      return { ...entry, id, skipped: false, sets: entry.sets.filter((set) => set.done).map((set) => ({ ...set,
        id: createLocalId('set'), workoutExerciseId: id, done: false, createdAt: now, completedAt: undefined })) };
    });
    openWorkout({ id: createLocalId('session'), userId: localUserId, dayId: today, templateId: log.templateId,
      name: log.name, notes: log.notes, startedAt: now, exerciseIndex: 0, setIndex: 0, phase: 'set', restTargetSeconds: entries[0]?.restSeconds ?? 90, entries });
  }

  function deleteLog(id: string) {
    const deleted = logs.find((log) => log.id === id);
    if (!deleted) return;
    setState((current) => ({ ...current, logs: current.logs.filter((log) => log.id !== id) }));
    setUndo({ label: 'Tréning bol vymazaný', apply: (current) => ({ ...current, logs: current.logs.some((log) => log.id === id) ? current.logs : [...current.logs, deleted] }) });
  }
  function updateLog(log: WorkoutLog) {
    setState((current) => ({ ...current, logs: current.logs.map((item) => item.id === log.id ? log : item) }));
  }
  async function importBackup(imported: TrainingState) {
    const previous = state;
    await importState(imported);
    setUndo({ label: 'Záloha bola importovaná', apply: () => previous });
    setSelectedDate(today);
    setNotice('Import je uložený.');
  }
  function addCustom(input: CustomExerciseInput) {
    const exercise = createCustomExercise(input, { id: createLocalId('custom'), userId: localUserId });
    setState((current) => ({ ...current, customExercises: [...current.customExercises, exercise] }));
    setSelectedExerciseId(exercise.id);
  }
  function editCustom(id: string, input: CustomExerciseInput) {
    setState((current) => ({ ...current, customExercises: current.customExercises.map((exercise) => exercise.id === id ? updateCustomExercise(exercise, input, localUserId) : exercise) }));
  }
  function addTemplate() {
    const template = createWorkoutTemplate({ name: 'Nový plán' }, { id: createLocalId('template'), userId: localUserId, createdAt: Date.now() });
    setState((current) => ({ ...current, templates: [...current.templates, template] }));
    return template;
  }
  function duplicateTemplate(id: string) {
    const source = templates.find((template) => template.id === id);
    if (!source) throw new Error('Plán neexistuje.');
    const duplicate = duplicateWorkoutTemplate(source, { id: createLocalId('template'), userId: localUserId, createdAt: Date.now(), templateExerciseIds: source.exercises.map(() => createLocalId('exercise')) });
    setState((current) => ({ ...current, templates: [...current.templates, duplicate] }));
    return duplicate;
  }
  function changeTemplate(id: string, change: (template: WorkoutTemplate) => WorkoutTemplate) {
    setState((current) => ({ ...current, templates: current.templates.map((template) => template.id === id ? change(identifyStarterTemplate(template)) : template) }));
  }
  function deleteTemplate(id: string) {
    const deleted = templates.find((template) => template.id === id);
    if (!deleted) return;
    setState((current) => ({ ...current, templates: current.templates.filter((template) => template.id !== id) }));
    setUndo({ label: 'Plán bol vymazaný', apply: (current) => ({ ...current, templates: current.templates.some((template) => template.id === id) ? current.templates : [...current.templates, deleted] }) });
  }

  if (!ready || hasConflict) return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>{status === 'loading' ? 'Načítavam tréningy…' : hasConflict ? 'Zmeny v inej karte' : 'Dáta sa nepodarilo načítať'}</Text>
    {error ? <><Text style={styles.compactText}>{error}</Text><Pressable style={styles.secondaryFull} onPress={reload}><Text style={styles.secondaryText}>Skúsiť načítať znova</Text></Pressable>
      <BackupPanel state={state} allowExport={ready} onImport={importBackup} /></> : null}
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}>
    <StatusBar style="light" />
    <View style={styles.app}>
      <BackgroundLines />
      <View style={styles.header}>
        <View style={styles.logoFrame}><Image source={hamsterLogo} style={styles.logo} /></View>
        <View style={styles.headerText}><Text style={styles.title}>{screenTitle(tab)}</Text></View>
        <View style={styles.headerClock}><Text style={styles.badgeLabel}>{activeWorkout ? 'Trvanie' : 'Tréningy'}</Text><Text style={styles.headerClockText}>{activeWorkout ? formatTime(getWorkoutElapsedSeconds(activeWorkout, nowTick)) : logs.length}</Text></View>
      </View>
      <View style={styles.savingStatus}>
        <SavingIndicator status={status} error={error} />
        {status === 'error' ? <View style={styles.chipRow}>
          <Pressable style={styles.smallButton} accessibilityRole="button" onPress={retrySave}><Text style={styles.smallButtonText}>Zopakovať uloženie</Text></Pressable>
          <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => setBackupOpen(true)}><Text style={styles.smallButtonText}>Exportovať zálohu</Text></Pressable>
        </View> : null}
      </View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, tab === 'workout' ? styles.workoutContent : null, activeWorkout?.phase === 'rest' && tab === 'workout' ? styles.contentWithRestDock : null]}>
        {notice && !undo ? <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{notice}</Text>
          <Pressable style={styles.feedbackClose} onPress={() => setNotice('')} accessibilityRole="button" accessibilityLabel="Zavrieť oznámenie"><Text style={styles.feedbackCloseText}>×</Text></Pressable>
        </View> : null}
        {undo ? <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{undo.label}</Text>
          <Pressable style={styles.feedbackAction} onPress={() => { setState(undo.apply); setUndo(null); }} accessibilityRole="button"><Text style={styles.feedbackActionText}>Vrátiť zmenu</Text></Pressable>
          <Pressable style={styles.feedbackClose} onPress={() => { setUndo(null); setNotice(''); }} accessibilityRole="button" accessibilityLabel="Zavrieť oznámenie"><Text style={styles.feedbackCloseText}>×</Text></Pressable>
        </View> : null}
        {tab === 'today' ? <TodayScreen logs={todayLogs} allLogs={logs} exercises={exercises} userId={localUserId} today={today} templates={templates} nextTemplate={nextTemplate} nextTemplateLastLog={nextTemplateLastLog}
          activeWorkoutLabel={activeWorkout?.name ?? null} activeWorkoutElapsed={activeWorkout ? getWorkoutElapsedSeconds(activeWorkout, nowTick) : 0} hasActiveWorkout={Boolean(activeWorkout)}
          onStartTemplate={startTemplate} onStartEmpty={startEmpty} onStartStarter={startStarter} onResume={() => setTab('workout')} onCancelWorkout={() => setConfirmCancel(true)} onOpenPlans={() => setTab('templates')}
          onOpenLog={(id) => { const log = logs.find((item) => item.id === id); if (log) { setSelectedDate(log.date); setInitialOpenLogId(id); setTab('calendar'); } }} /> : null}
        {tab === 'library' ? <LibraryScreen exercises={exercises} selectedExercise={selectedExercise} level={level} logs={logs} userId={localUserId} machineMemories={machineMemories} onSelectExercise={setSelectedExerciseId} onLevel={setLevel} onCreateCustomExercise={addCustom} onUpdateCustomExercise={editCustom} /> : null}
        {tab === 'templates' ? <TemplatesScreen templates={templates} exercises={exercises} userId={localUserId} savingStatus={status} savingError={error} onRetrySave={retrySave} onCreate={addTemplate} onDuplicate={duplicateTemplate} onStart={startTemplate}
          onUpdateDetails={(id, patch) => changeTemplate(id, (template) => updateWorkoutTemplateDetails(template, patch, Date.now()))}
          onAddExercise={(id, exerciseId) => changeTemplate(id, (template) => addExerciseToTemplate(template, exerciseId, createLocalId('exercise'), Date.now(), getExerciseMetric(getExercise(exerciseId, exercises))))}
          onUpdateExercise={(id, exerciseId, patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>) => changeTemplate(id, (template) => updateTemplateExercise(template, exerciseId, patch, Date.now()))}
          onRemoveExercise={(id, exerciseId) => changeTemplate(id, (template) => removeExerciseFromTemplate(template, exerciseId, Date.now()))}
          onMoveExercise={(id, exerciseId, direction) => changeTemplate(id, (template) => moveExerciseInTemplate(template, exerciseId, direction, Date.now()))}
          onArchive={(id, archived) => changeTemplate(id, (template) => setTemplateArchived(template, archived, Date.now()))} onDelete={deleteTemplate}
          onMoveTemplate={(id, direction) => setState((current) => ({ ...current, templates: moveTemplate(current.templates, id, direction) }))}
          onAddStarter={addStarter} /> : null}
        {tab === 'calendar' ? <CalendarScreen exercises={exercises} weekDays={weekDays} weekOffset={weekOffset} selectedDate={selectedDate} selectedLogs={selectedLogs} allLogs={logs} today={today} initialOpenLogId={initialOpenLogId}
          onSelectDate={setSelectedDate} onPreviousWeek={() => { setWeekOffset(weekOffset - 1); setSelectedDate(addDays(selectedDate, -7)); }} onNextWeek={() => { setWeekOffset(weekOffset + 1); setSelectedDate(addDays(selectedDate, 7)); }}
          onOpenPlans={() => setTab('templates')} onUpdateLog={updateLog} onDeleteLog={deleteLog} onRepeatLog={repeatWorkout} /> : null}
        {tab === 'profile' ? <View style={styles.screen}><SocialPanel account={account} /><Pressable accessibilityRole="button" accessibilityLabel="Záloha tréningov" style={styles.card} onPress={() => setBackupOpen(true)}><Text style={styles.rowTitle}>Záloha tréningov</Text><Text style={styles.rowMuted}>Stiahnuť JSON zálohu alebo importovať dáta</Text></Pressable><ProfileScreen logs={logs} schedule={schedule} exercises={exercises} onUpdateLog={updateLog} onDeleteLog={deleteLog} onRepeatLog={repeatWorkout} /></View> : null}
        {tab === 'workout' && activeWorkout ? <View style={styles.screen}>
          <WorkoutScreen workout={activeWorkout} exercises={exercises} logs={logs} now={nowTick} previousSets={activePreviousSets} personalRecords={calculatePersonalRecords(activeWorkout.entries, logs, localUserId)}
            onChange={(workout) => setState((current) => ({ ...current, activeWorkout: workout }))} onFinish={saveWorkout} onCancel={() => setConfirmCancel(true)} onMinimize={() => setTab('today')}
            machineMemoryPanel={visibleEntry ? <MachineMemoryPanel key={`${visibleEntry.id}-${visibleEntry.machineMemoryId ?? ''}`} entry={visibleEntry} memories={machineMemories} logs={logs} userId={localUserId}
              onSelect={(memory) => changeWorkout((workout) => linkWorkoutMachine(workout, visibleEntry.id, memory))}
              onSave={(input) => setState((current) => { const result = saveMachineMemory(current.machineMemories ?? [], input, createLocalId('machine'), Date.now()); return { ...current, machineMemories: result.memories, activeWorkout: current.activeWorkout ? linkWorkoutMachine(current.activeWorkout, visibleEntry.id, result.memory) : null }; })} /> : null} />
        </View> : null}
      </ScrollView>
      <BottomSheet visible={backupOpen} title="Záloha tréningov" subtitle="Export a import dát z tohto zariadenia" onClose={() => setBackupOpen(false)}><BackupPanel state={state} onImport={importBackup} /></BottomSheet>
      <ConfirmationDialog visible={confirmCancel && Boolean(activeWorkout)} title="Zrušiť rozbehnutý tréning?" description="Odcvičené série sa neuložia do histórie. Po zrušení môžeš zmenu vrátiť." onConfirm={discardWorkout} onCancel={() => setConfirmCancel(false)} />
      {tab === 'workout' && activeWorkout?.phase === 'rest' ? <WorkoutRestDock workout={activeWorkout} now={nowTick}
        onPause={() => changeWorkout((workout) => pauseRestTimer(workout, Date.now()))} onResume={() => changeWorkout((workout) => resumeRestTimer(workout, Date.now()))}
        onAdjust={(seconds) => changeWorkout((workout) => adjustRestTimer(workout, seconds, Date.now()))}
        onSkip={() => changeWorkout((workout) => advanceToNextSet(workout))} /> : null}
      {tab !== 'workout' ? <View style={styles.tabBar}>{tabs.map((item) => <Pressable key={item.key} onPress={() => { setTab(item.key); setConfirmCancel(false); }} style={[styles.tabButton, tab === item.key ? styles.tabActive : null]}><Text style={[styles.tabText, tab === item.key ? styles.tabTextActive : null]}>{item.label}</Text></Pressable>)}</View> : null}
    </View>
  </SafeAreaView>;
}
