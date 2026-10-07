import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getMachineLastPerformance } from '../domain/machineMemory';
import { formatSetPerformance, getEntryMetric } from '../domain/metrics';
import { colors, styles } from '../theme/styles';
import { MachineMemory, WorkoutExerciseState, WorkoutLog } from '../types';
import { DisclosureSection } from './DisclosureSection';

type Props = {
  entry: WorkoutExerciseState;
  memories: MachineMemory[];
  logs: WorkoutLog[];
  userId: string;
  onSave: (input: Omit<MachineMemory, 'id' | 'lastUsedAt'>) => void;
  onSelect: (memory: MachineMemory | null) => void;
};

export function MachineMemoryPanel({ entry, memories, logs, userId, onSave, onSelect }: Props) {
  const current = memories.find((memory) => memory.id === entry.machineMemoryId);
  const stations = memories.filter((memory) => memory.exerciseId === entry.exerciseId);
  const [editing, setEditing] = useState(false);
  const [gymName, setGymName] = useState(current?.gymName ?? '');
  const [machineName, setMachineName] = useState(current?.machineName ?? '');
  const [settings, setSettings] = useState(current?.settings ?? '');
  const [error, setError] = useState<string | null>(null);
  const history = current ? getMachineLastPerformance(logs, current.id, userId) : null;

  const selectStation = (memory: MachineMemory | null) => {
    onSelect(memory);
    setGymName(memory?.gymName ?? '');
    setMachineName(memory?.machineName ?? '');
    setSettings(memory?.settings ?? '');
    setError(null);
    setEditing(false);
  };

  const saveStation = () => {
    if (!gymName.trim() || !machineName.trim()) {
      setError('Vyplň fitko aj názov stroja.');
      return;
    }
    try {
      onSave({ exerciseId: entry.exerciseId, gymName, machineName, settings });
      setError(null);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Stroj sa nepodarilo uložiť.');
    }
  };

  return <View style={machineStyles.content}>
    {current ? <View style={machineStyles.current}>
      <Text style={machineStyles.label}>Zvolený stroj</Text>
      <Text style={machineStyles.title}>{current.gymName} · {current.machineName}</Text>
      {current.settings ? <Text style={machineStyles.details}>{current.settings}</Text> : null}
      {history ? <Text style={machineStyles.details}>Posledný výkon: {history.sets.filter((set) => set.done).map((set) => formatSetPerformance(set, getEntryMetric(history))).join(' · ')}</Text> : null}
    </View> : <Text style={machineStyles.details}>Vyber stroj a uchováš jeho nastavenia aj posledný výkon.</Text>}

    {stations.length ? <View style={machineStyles.stations}>
      {stations.map((memory) => <Pressable key={memory.id} style={[machineStyles.station, current?.id === memory.id && machineStyles.stationSelected]}
        accessibilityRole="button" accessibilityLabel={`Použiť ${memory.gymName}, ${memory.machineName}`} accessibilityState={{ selected: current?.id === memory.id }} onPress={() => selectStation(memory)}>
        <View style={machineStyles.stationText}>
          <Text style={machineStyles.stationName}>{memory.machineName}</Text>
          <Text style={machineStyles.details}>{memory.gymName}</Text>
        </View>
        {current?.id === memory.id ? <Text style={machineStyles.check}>✓</Text> : null}
      </Pressable>)}
    </View> : null}

    <DisclosureSection title={current ? 'Add / edit machine' : 'Add machine'} open={editing} onToggle={(next) => {
      setGymName(current?.gymName ?? '');
      setMachineName(current?.machineName ?? '');
      setSettings(current?.settings ?? '');
      setError(null);
      setEditing(next);
    }}>
      <View style={machineStyles.field}>
        <Text style={machineStyles.label}>Fitko</Text>
        <TextInput value={gymName} onChangeText={setGymName} style={styles.textInput} placeholder="Názov fitka" placeholderTextColor={colors.muted} accessibilityLabel="Fitko" />
      </View>
      <View style={machineStyles.field}>
        <Text style={machineStyles.label}>Stroj / stanica</Text>
        <TextInput value={machineName} onChangeText={setMachineName} style={styles.textInput} placeholder="Názov alebo číslo stroja" placeholderTextColor={colors.muted} accessibilityLabel="Stroj" />
      </View>
      <View style={machineStyles.field}>
        <Text style={machineStyles.label}>Nastavenia</Text>
        <TextInput value={settings} onChangeText={setSettings} style={[styles.noteInput, machineStyles.note]} placeholder="Sedadlo, úchop, nastavenie…" placeholderTextColor={colors.muted} multiline accessibilityLabel="Nastavenia stroja" />
      </View>
      {error ? <Text style={machineStyles.error} accessibilityRole="alert">{error}</Text> : null}
      <Pressable style={machineStyles.save} accessibilityRole="button" onPress={saveStation}><Text style={machineStyles.saveText}>Uložiť a použiť stroj</Text></Pressable>
    </DisclosureSection>

    {current ? <Pressable style={machineStyles.disconnect} accessibilityRole="button" onPress={() => selectStation(null)}>
      <Text style={machineStyles.details}>Odpojiť stroj od cviku</Text>
    </Pressable> : null}
  </View>;
}

const machineStyles = StyleSheet.create({
  content: { gap: 12 },
  current: { gap: 5 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  details: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  stations: { gap: 6 },
  station: { borderColor: colors.line, borderWidth: 1, borderRadius: 10, minHeight: 52, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stationSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  stationText: { flex: 1, gap: 2 },
  stationName: { color: colors.text, fontSize: 13, fontWeight: '500' },
  check: { color: colors.accent, fontSize: 18 },
  field: { gap: 3 },
  note: { marginTop: 3, minHeight: 74 },
  error: { color: colors.pink, fontSize: 13, lineHeight: 19 },
  save: { minHeight: 46, backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  saveText: { color: colors.onPrimary, fontSize: 13, fontWeight: '700' },
  disconnect: { minHeight: 44, justifyContent: 'center' },
});
