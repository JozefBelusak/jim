import { describe, expect, it } from 'vitest';
import { saveMachineMemory } from './machineMemory';

describe('machine memory', () => {
  it('updates an existing station, while keeping separate gyms and exercises separate', () => {
    const input = { exerciseId: 'chest-press', gymName: ' Gym A ', machineName: ' Press 1 ', settings: 'Seat 3' };
    const first = saveMachineMemory([], input, 'memory-1', 1);
    const updated = saveMachineMemory(first.memories, { ...input, gymName: 'gym a', settings: 'Seat 4' }, 'unused', 2);
    expect(updated.memories).toHaveLength(1);
    expect(updated.memory.id).toBe('memory-1');
    expect(updated.memory.settings).toBe('Seat 4');
    expect(saveMachineMemory(updated.memories, { ...input, gymName: 'Gym B' }, 'memory-2', 3).memories).toHaveLength(2);
  });
});
