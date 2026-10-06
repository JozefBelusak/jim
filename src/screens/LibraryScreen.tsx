import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { CustomExerciseForm } from '../components/CustomExerciseForm';
import { ExerciseProgressPanel } from '../components/ExerciseProgressPanel';
import { ExerciseSearch } from '../components/ExerciseSearch';
import {
  CustomExerciseInput,
  formatEquipment,
  formatExerciseMetric,
  formatMuscleGroup,
} from '../domain/exercises';
import { getExerciseMetric } from '../domain/metrics';
import { styles } from '../theme/styles';
import { Exercise, Level, MachineMemory, WorkoutLog } from '../types';

type LibraryScreenProps = {
  exercises: Exercise[];
  selectedExercise: Exercise;
  level: Level;
  logs: WorkoutLog[];
  machineMemories?: MachineMemory[];
  userId: string;
  onSelectExercise: (exerciseId: string) => void;
  onLevel: (level: Level) => void;
  onCreateCustomExercise: (input: CustomExerciseInput) => void;
  onUpdateCustomExercise: (exerciseId: string, input: CustomExerciseInput) => void;
};

export function LibraryScreen({
  exercises,
  selectedExercise,
  level,
  logs,
  machineMemories,
  userId,
  onSelectExercise,
  onLevel,
  onCreateCustomExercise,
  onUpdateCustomExercise,
}: LibraryScreenProps) {
  const [formExerciseId, setFormExerciseId] = useState<'new' | string | null>(null);
  const formExercise = formExerciseId && formExerciseId !== 'new'
    ? exercises.find((exercise) => exercise.id === formExerciseId)
    : undefined;

  function saveCustomExercise(input: CustomExerciseInput) {
    if (formExercise) {
      onUpdateCustomExercise(formExercise.id, input);
    } else {
      onCreateCustomExercise(input);
    }
    setFormExerciseId(null);
  }

  return (
    <View style={styles.screen}>
      <ExerciseSearch exercises={exercises} selectedId={selectedExercise.id} onSelect={onSelectExercise} />
      <View style={styles.libraryDetailCard}>
        <View style={styles.libraryHeroTop}>
          <View style={styles.exerciseDetailTitle}>
            <Text style={styles.eyebrow}>Selected exercise</Text>
            <Text style={styles.cardTitle}>{selectedExercise.name}</Text>
            <View style={styles.metaPillRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{formatMuscleGroup(selectedExercise.primaryMuscle)}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{formatEquipment(selectedExercise.equipment)}</Text>
              </View>
              <View style={styles.metaPill}><Text style={styles.metaPillText}>{formatExerciseMetric(getExerciseMetric(selectedExercise))}</Text></View>
              {selectedExercise.isCustom ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Custom</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {selectedExercise.equipmentAlternatives?.length ? <Text style={styles.rowMuted}>Also available with: {selectedExercise.equipmentAlternatives.map(formatEquipment).join(', ')}</Text> : null}
        {selectedExercise.imageUrl ? <Image source={{ uri: selectedExercise.imageUrl }} style={{ width: '100%', height: 220, borderRadius: 10 }} resizeMode="contain" accessibilityLabel={`${selectedExercise.name} technique`} /> : null}
        {selectedExercise.videoUrl ? <Pressable style={styles.secondaryFull} onPress={() => { if (selectedExercise.videoUrl) void Linking.openURL(selectedExercise.videoUrl); }}><Text style={styles.secondaryText}>Watch technique video</Text></Pressable> : null}
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
            {(level === 'simple' ? selectedExercise.instructions : selectedExercise.technicalInstructions) || selectedExercise.instructions || 'No coach notes have been added to this exercise.'}
          </Text>
        </View>

        {selectedExercise.isCustom ? (
          <Pressable style={styles.secondaryFull} onPress={() => setFormExerciseId(selectedExercise.id)}>
            <Text style={styles.secondaryText}>Edit custom exercise</Text>
          </Pressable>
        ) : null}
      </View>

      <ExerciseProgressPanel exercise={selectedExercise} logs={logs} userId={userId} machineMemories={machineMemories} />

      <Pressable style={styles.primaryWide} onPress={() => setFormExerciseId('new')}>
        <Text style={styles.primaryText}>CREATE CUSTOM EXERCISE</Text>
      </Pressable>

      {formExerciseId ? (
        <CustomExerciseForm
          key={formExerciseId}
          exercise={formExercise}
          onSave={saveCustomExercise}
          onCancel={() => setFormExerciseId(null)}
        />
      ) : null}

    </View>
  );
}
