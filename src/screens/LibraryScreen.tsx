import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { CustomExerciseForm } from '../components/CustomExerciseForm';
import { ExerciseProgressPanel } from '../components/ExerciseProgressPanel';
import { Section } from '../components/ui';
import {
  CustomExerciseInput,
  EquipmentFilter,
  MuscleFilter,
  allEquipmentFilter,
  allMusclesFilter,
  filterExercises,
  formatEquipment,
  formatMuscleGroup,
  getEquipmentFilters,
  getMuscleFilters,
} from '../domain/exercises';
import { styles } from '../theme/styles';
import { Exercise, Level, WorkoutLog } from '../types';

type LibraryScreenProps = {
  exercises: Exercise[];
  selectedExercise: Exercise;
  level: Level;
  logs: WorkoutLog[];
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
  userId,
  onSelectExercise,
  onLevel,
  onCreateCustomExercise,
  onUpdateCustomExercise,
}: LibraryScreenProps) {
  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<MuscleFilter>(allMusclesFilter);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>(allEquipmentFilter);
  const [formExerciseId, setFormExerciseId] = useState<'new' | string | null>(null);
  const muscleFilters = getMuscleFilters(exercises);
  const equipmentFilters = getEquipmentFilters(exercises);
  const visibleExercises = filterExercises(exercises, {
    query,
    muscle: muscleFilter,
    equipment: equipmentFilter,
  });
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
              {selectedExercise.isCustom ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>Custom</Text>
                </View>
              ) : null}
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
            {level === 'simple' ? selectedExercise.instructions : selectedExercise.technicalInstructions}
          </Text>
        </View>

        {selectedExercise.isCustom ? (
          <Pressable style={styles.secondaryFull} onPress={() => setFormExerciseId(selectedExercise.id)}>
            <Text style={styles.secondaryText}>Edit custom exercise</Text>
          </Pressable>
        ) : null}
      </View>

      <ExerciseProgressPanel exercise={selectedExercise} logs={logs} userId={userId} />

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

      <Section title="Find exercise" />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search exercises"
        placeholderTextColor="#71717A"
        style={styles.textInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.chipRow}>
        {muscleFilters.map((muscle) => (
          <Pressable
            key={muscle}
            style={[styles.chip, muscleFilter === muscle ? styles.chipActive : null]}
            onPress={() => setMuscleFilter(muscle)}
          >
            <Text style={styles.chipText}>
              {muscle === allMusclesFilter ? 'All muscles' : formatMuscleGroup(muscle)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {equipmentFilters.map((equipment) => (
          <Pressable
            key={equipment}
            style={[styles.chip, equipmentFilter === equipment ? styles.chipActive : null]}
            onPress={() => setEquipmentFilter(equipment)}
          >
            <Text style={styles.chipText}>
              {equipment === allEquipmentFilter ? 'All equipment' : formatEquipment(equipment)}
            </Text>
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
            <Text style={styles.rowValue}>{formatMuscleGroup(exercise.primaryMuscle)}</Text>
          </Pressable>
        ))}
      </View>
      {visibleExercises.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.compactText}>No exercises match these filters.</Text>
        </View>
      ) : null}
    </View>
  );
}
