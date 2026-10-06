import { ActiveWorkout, MachineMemory, WorkoutLog } from '../types';

export function saveMachineMemory(memories: MachineMemory[], input: Omit<MachineMemory, 'id' | 'lastUsedAt'>, id: string, now: number) {
  const normalized = { ...input, gymName: input.gymName.trim(), machineName: input.machineName.trim(), settings: input.settings.trim() };
  if (!normalized.gymName || !normalized.machineName) throw new Error('Vyplň fitko aj názov stroja.');
  const existing = memories.find((memory) => memory.exerciseId === input.exerciseId &&
    memory.gymName.toLocaleLowerCase() === normalized.gymName.toLocaleLowerCase() &&
    memory.machineName.toLocaleLowerCase() === normalized.machineName.toLocaleLowerCase());
  const memory: MachineMemory = { ...normalized, id: existing?.id ?? id, lastUsedAt: now };
  return { memory, memories: existing ? memories.map((item) => item.id === memory.id ? memory : item) : [...memories, memory] };
}

export function linkWorkoutMachine(workout: ActiveWorkout, entryId: string, memory: MachineMemory | null): ActiveWorkout {
  return { ...workout, entries: workout.entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    if (memory && memory.exerciseId !== entry.exerciseId) throw new Error('Stroj patrí inému cviku.');
    return { ...entry, machineMemoryId: memory?.id };
  }) };
}

export function getMachineLastPerformance(logs: WorkoutLog[], memoryId: string, userId: string) {
  return [...logs].filter((log) => log.userId === userId).sort((a, b) => b.startedAt - a.startedAt)
    .flatMap((log) => log.entries.filter((entry) => entry.machineMemoryId === memoryId))
    .find((entry) => entry.sets.some((set) => set.done)) ?? null;
}
