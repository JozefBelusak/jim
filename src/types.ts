export type TabKey = 'today' | 'library' | 'calendar' | 'profile' | 'workout';
export type Level = 'simple' | 'technical';
export type WorkoutPhase = 'set' | 'rest' | 'between' | 'complete';

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  simple: string;
  technical: string;
};

export type PlanExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  weightKg: number;
  restSeconds: number;
};

export type PlanDay = {
  id: string;
  date: string;
  label: string;
  focus: string;
  exercises: PlanExercise[];
  rest?: boolean;
};

export type WorkoutSet = {
  id: string;
  targetReps: number;
  reps: number;
  weightKg: number;
  done: boolean;
  note?: string;
};

export type WorkoutExerciseState = {
  exerciseId: string;
  sets: WorkoutSet[];
};

export type ActiveWorkout = {
  dayId: string;
  startedAt: number;
  exerciseIndex: number;
  setIndex: number;
  phase: WorkoutPhase;
  restTargetSeconds: number;
  restStartedAt?: number;
  entries: WorkoutExerciseState[];
};

export type WorkoutLog = {
  id: string;
  dayId: string;
  date: string;
  volumeKg: number;
  durationSeconds: number;
  entries: WorkoutExerciseState[];
};

export type CalendarDay = {
  iso: string;
  weekday: string;
  dayNumber: string;
  inMonth: boolean;
  planDay?: PlanDay;
  done: boolean;
};
