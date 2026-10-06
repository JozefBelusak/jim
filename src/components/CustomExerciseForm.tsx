import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  CustomExerciseInput,
  equipmentOptions,
  formatEquipment,
  formatMuscleGroup,
  muscleGroupOptions,
} from '../domain/exercises';
import { styles } from '../theme/styles';
import { Equipment, Exercise, MovementType, MuscleGroup, WeightMode } from '../types';

const weightModeOptions: readonly WeightMode[] = ['external', 'bodyweight', 'bodyweight_plus'];

type CustomExerciseFormProps = {
  exercise?: Exercise;
  onSave: (input: CustomExerciseInput) => void;
  onCancel: () => void;
};

export function CustomExerciseForm({ exercise, onSave, onCancel }: CustomExerciseFormProps) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>(exercise?.primaryMuscle ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'machine');
  const [weightMode, setWeightMode] = useState<WeightMode>(exercise?.weightMode ?? 'external');
  const [instructions, setInstructions] = useState(exercise?.instructions ?? '');
  const [technicalInstructions, setTechnicalInstructions] = useState(exercise?.technicalInstructions ?? '');

  function selectMuscle(muscle: MuscleGroup) {
    setPrimaryMuscle(muscle);
  }

  function selectEquipment(nextEquipment: Equipment) {
    setEquipment(nextEquipment);
    if (nextEquipment === 'bodyweight') {
      setWeightMode('bodyweight');
    } else if (weightMode === 'bodyweight') {
      setWeightMode('external');
    }
  }

  function submit() {
    if (!name.trim()) {
      return;
    }

    onSave({
      name,
      primaryMuscle,
      secondaryMuscles: exercise?.secondaryMuscles ?? [],
      equipment,
      category: getDefaultCategory(primaryMuscle, exercise),
      movementType: getDefaultMovementType(primaryMuscle, exercise),
      weightMode,
      instructions,
      technicalInstructions,
      imageUrl: exercise?.imageUrl,
      videoUrl: exercise?.videoUrl,
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{exercise ? 'Edit custom exercise' : 'New custom exercise'}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Exercise name"
        placeholderTextColor="#71717A"
        style={styles.textInput}
        autoCapitalize="words"
      />

      <Text style={styles.compactText}>Primary muscle</Text>
      <View style={styles.chipRow}>
        {muscleGroupOptions.map((muscle) => (
          <Pressable
            key={muscle}
            style={[styles.chip, primaryMuscle === muscle ? styles.chipActive : null]}
            onPress={() => selectMuscle(muscle)}
          >
            <Text style={styles.chipText}>{formatMuscleGroup(muscle)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.compactText}>Equipment</Text>
      <View style={styles.chipRow}>
        {equipmentOptions.map((item) => (
          <Pressable
            key={item}
            style={[styles.chip, equipment === item ? styles.chipActive : null]}
            onPress={() => selectEquipment(item)}
          >
            <Text style={styles.chipText}>{formatEquipment(item)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.compactText}>Weight mode</Text>
      <View style={styles.chipRow}>
        {weightModeOptions.map((mode) => (
          <Pressable
            key={mode}
            style={[styles.chip, weightMode === mode ? styles.chipActive : null]}
            onPress={() => setWeightMode(mode)}
          >
            <Text style={styles.chipText}>{formatWeightMode(mode)}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={instructions}
        onChangeText={setInstructions}
        placeholder="Basic instructions (optional)"
        placeholderTextColor="#71717A"
        style={styles.noteInput}
        multiline
      />
      <TextInput
        value={technicalInstructions}
        onChangeText={setTechnicalInstructions}
        placeholder="Technical instructions (optional)"
        placeholderTextColor="#71717A"
        style={styles.noteInput}
        multiline
      />

      <Pressable
        disabled={!name.trim()}
        style={[styles.primaryWide, !name.trim() ? styles.disabledButton : null]}
        onPress={submit}
      >
        <Text style={styles.primaryText}>{exercise ? 'SAVE CHANGES' : 'CREATE EXERCISE'}</Text>
      </Pressable>
      <Pressable style={styles.secondaryFull} onPress={onCancel}>
        <Text style={styles.secondaryText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function getDefaultCategory(primaryMuscle: MuscleGroup, exercise?: Exercise) {
  if (primaryMuscle === exercise?.primaryMuscle) {
    return exercise.category;
  }

  return primaryMuscle === 'cardio' ? 'cardio' : primaryMuscle === 'abs' ? 'core' : 'isolation';
}

function getDefaultMovementType(primaryMuscle: MuscleGroup, exercise?: Exercise): MovementType {
  if (primaryMuscle === exercise?.primaryMuscle) {
    return exercise.movementType;
  }

  if (primaryMuscle === 'back' || primaryMuscle === 'lats' || primaryMuscle === 'biceps' || primaryMuscle === 'rear_delts') {
    return 'pull';
  }
  if (primaryMuscle === 'quads' || primaryMuscle === 'adductors') {
    return 'squat';
  }
  if (primaryMuscle === 'hamstrings' || primaryMuscle === 'glutes' || primaryMuscle === 'lower_back') {
    return 'hinge';
  }
  if (primaryMuscle === 'calves') {
    return 'calf_raise';
  }
  if (primaryMuscle === 'abs') {
    return 'spinal_flexion';
  }
  if (primaryMuscle === 'cardio') {
    return 'cardio';
  }

  return 'push';
}

function formatWeightMode(mode: WeightMode) {
  const labels: Record<WeightMode, string> = {
    external: 'External weight',
    bodyweight: 'Bodyweight',
    bodyweight_plus: 'Bodyweight + load',
  };
  return labels[mode];
}
