import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { getMachineLastPerformance } from '../domain/machineMemory';
import { formatSetPerformance, getEntryMetric } from '../domain/metrics';
import { styles } from '../theme/styles';
import { MachineMemory, WorkoutExerciseState, WorkoutLog } from '../types';

type Props = { entry: WorkoutExerciseState; memories: MachineMemory[]; logs: WorkoutLog[]; userId: string;
  onSave: (input: Omit<MachineMemory, 'id' | 'lastUsedAt'>) => void; onSelect: (memory: MachineMemory | null) => void };

export function MachineMemoryPanel({ entry, memories, logs, userId, onSave, onSelect }: Props) {
  const current = memories.find((memory) => memory.id === entry.machineMemoryId);
  const [open, setOpen] = useState(false);
  const [gymName, setGymName] = useState(current?.gymName ?? '');
  const [machineName, setMachineName] = useState(current?.machineName ?? '');
  const [settings, setSettings] = useState(current?.settings ?? '');
  const history = current ? getMachineLastPerformance(logs, current.id, userId) : null;
  return <View style={styles.card}>
    <Pressable onPress={() => setOpen(!open)}><Text style={styles.rowTitle}>{current ? `${current.gymName} · ${current.machineName}` : 'Pamäť fitka a stroja'} {open ? '▴' : '▾'}</Text></Pressable>
    {current ? <Text style={styles.rowMuted}>{current.settings}</Text> : null}
    {history ? <Text style={styles.compactText}>Posledný výkon: {history.sets.filter((set) => set.done).map((set) => formatSetPerformance(set, getEntryMetric(history))).join(' · ')}</Text> : null}
    {open ? <View style={styles.screen}>
      <Text style={styles.rowMuted}>Výkony sa porovnávajú v rámci zvoleného stroja.</Text>
      {memories.filter((memory) => memory.exerciseId === entry.exerciseId).map((memory) => <Pressable key={memory.id} style={styles.smallButton} onPress={() => { onSelect(memory); setGymName(memory.gymName); setMachineName(memory.machineName); setSettings(memory.settings); }}>
        <Text style={styles.smallButtonText}>{memory.gymName} · {memory.machineName}</Text>
      </Pressable>)}
      <TextInput value={gymName} onChangeText={setGymName} style={styles.textInput} placeholder="Názov fitka" placeholderTextColor="#AAAAC4" accessibilityLabel="Fitko" />
      <TextInput value={machineName} onChangeText={setMachineName} style={styles.textInput} placeholder="Stroj / stanica" placeholderTextColor="#AAAAC4" accessibilityLabel="Stroj" />
      <TextInput value={settings} onChangeText={setSettings} style={styles.noteInput} placeholder="Sedadlo, úchop, nastavenie…" placeholderTextColor="#AAAAC4" multiline accessibilityLabel="Nastavenia stroja" />
      <Pressable disabled={!gymName.trim() || !machineName.trim()} style={styles.secondaryFull} onPress={() => onSave({ exerciseId: entry.exerciseId, gymName, machineName, settings })}><Text style={styles.secondaryText}>Uložiť a použiť stroj</Text></Pressable>
      {current ? <Pressable style={styles.smallButton} onPress={() => onSelect(null)}><Text style={styles.smallButtonText}>Odpojiť stroj od cviku</Text></Pressable> : null}
    </View> : null}
  </View>;
}
