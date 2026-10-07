export type TabKey = 'today' | 'templates' | 'library' | 'calendar' | 'profile' | 'workout';
export type Level = 'simple' | 'technical';
export type WorkoutPhase = 'set' | 'rest' | 'between' | 'complete';
export type SetType = 'warmup' | 'normal' | 'drop' | 'failure';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'lats'
  | 'traps'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'abs'
  | 'lower_back'
  | 'cardio';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'smith_machine'
  | 'plate_loaded_machine'
  | 'ez_bar'
  | 'pull_up_bar'
  | 'treadmill'
  | 'other';

export type ExerciseCategory = 'compound' | 'isolation' | 'core' | 'cardio';
export type MovementType =
  | 'push'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'calf_raise'
  | 'spinal_flexion'
  | 'rotation'
  | 'isometric'
  | 'cardio';
export type WeightMode = 'external' | 'bodyweight' | 'bodyweight_plus';
export type ExerciseMetric = 'weight_reps' | 'reps' | 'duration' | 'distance_duration' | 'assisted_reps';

export type MachineMemory = {
  id: string;
  exerciseId: string;
  gymName: string;
  machineName: string;
  settings: string;
  lastUsedAt: number;
};

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  movementType: MovementType;
  weightMode: WeightMode;
  metric?: ExerciseMetric;
  equipmentAlternatives?: Equipment[];
  instructions?: string;
  technicalInstructions?: string;
  imageUrl?: string;
  videoUrl?: string;
  isCustom: boolean;
  createdBy?: string;
};

export type PlanExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
  repRangeMin?: number;
  repRangeMax?: number;
  targetRir?: number;
  notes?: string;
};

export type PlanDay = {
  id: string;
  date: string;
  label: string;
  focus: string;
  exercises: PlanExercise[];
  rest?: boolean;
};

export type TemplateExercise = {
  id: string;
  exerciseId: string;
  order: number;
  targetSets?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  targetRir?: number;
  restSeconds?: number;
  notes?: string;
};

export type WorkoutTemplate = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: TemplateExercise[];
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
  starterKey?: string;
};

export type WorkoutSet = {
  id: string;
  workoutExerciseId: string;
  type: SetType;
  targetReps: number;
  reps: number;
  weightKg: number;
  done: boolean;
  note?: string;
  createdAt: number;
  completedAt?: number;
  repRangeMin?: number;
  repRangeMax?: number;
  targetRir?: number;
  rir?: number;
  rpe?: number;
  durationSeconds?: number;
  distanceKm?: number;
};

export type WorkoutExerciseState = {
  id: string;
  exerciseId: string;
  restSeconds?: number;
  notes?: string;
  supersetGroupId?: string;
  metric?: ExerciseMetric;
  skipped?: boolean;
  machineMemoryId?: string;
  sets: WorkoutSet[];
};

export type ActiveWorkout = {
  id: string;
  userId: string;
  dayId: string;
  templateId?: string;
  name: string;
  notes?: string;
  startedAt: number;
  exerciseIndex: number;
  setIndex: number;
  phase: WorkoutPhase;
  restTargetSeconds: number;
  restStartedAt?: number;
  restEndsAt?: number;
  restPausedRemainingSeconds?: number;
  completedAt?: number;
  pausedAt?: number;
  pausedDurationMs?: number;
  restNextExerciseId?: string;
  restNextSetId?: string;
  deadlineAt?: number;
  entries: WorkoutExerciseState[];
};

export type WorkoutLog = {
  id: string;
  userId: string;
  dayId: string;
  templateId?: string;
  name: string;
  notes?: string;
  date: string;
  startedAt: number;
  finishedAt: number;
  volumeKg: number;
  durationSeconds: number;
  entries: WorkoutExerciseState[];
};

export type PersonalRecordType =
  | 'highest_weight'
  | 'reps_at_weight'
  | 'estimated_1rm'
  | 'set_volume'
  | 'exercise_session_volume'
  | 'most_reps'
  | 'longest_duration'
  | 'longest_distance'
  | 'least_assistance';

export type PersonalRecord = {
  type: PersonalRecordType;
  exerciseId: string;
  setId?: string;
  value: number;
  previousValue: number;
  weightKg?: number;
  reps?: number;
};

export type ProgressTimeframe = '1m' | '3m' | '6m' | '1y' | 'all';

export type ExerciseProgressPoint = {
  logId: string;
  date: string;
  timestamp: number;
  maxWeightKg: number;
  estimated1RmKg: number;
  volumeKg: number;
  workingSets: WorkoutSet[];
  metric?: ExerciseMetric;
  bestReps?: number;
  longestDurationSeconds?: number;
  longestDistanceKm?: number;
  minAssistanceKg?: number;
};

export type ExerciseProgress = {
  points: ExerciseProgressPoint[];
  lastPerformance: ExerciseProgressPoint | null;
  bestWeightKg: number;
  bestEstimated1RmKg: number;
  bestSessionVolumeKg: number;
  sessionsPerWeek: number;
  metric?: ExerciseMetric;
  bestReps?: number;
  longestDurationSeconds?: number;
  longestDistanceKm?: number;
  minAssistanceKg?: number;
};

export type CalendarDay = {
  iso: string;
  weekday: string;
  dayNumber: string;
  inMonth: boolean;
  done: boolean;
  workoutCount: number;
};
