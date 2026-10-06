import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
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
import { Exercise } from '../types';

export type ExerciseSearchProps = {
  exercises: Exercise[];
  onSelect: (exerciseId: string) => void;
  selectedId?: string;
  actionLabel?: string;
  excludedIds?: string[];
  title?: string;
  maxVisible?: number;
};

export function ExerciseSearch({
  exercises,
  onSelect,
  selectedId,
  actionLabel,
  excludedIds = [],
  title = 'Find exercise',
  maxVisible = 8,
}: ExerciseSearchProps) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleFilter>(allMusclesFilter);
  const [equipment, setEquipment] = useState<EquipmentFilter>(allEquipmentFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(maxVisible);
  const visible = filterExercises(exercises, { query, muscle, equipment })
    .filter((exercise) => !excludedIds.includes(exercise.id));
  const hasFilters = muscle !== allMusclesFilter || equipment !== allEquipmentFilter;

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Pressable style={styles.smallButton} onPress={() => setFiltersOpen(!filtersOpen)}>
          <Text style={styles.smallButtonText}>{filtersOpen ? 'Hide filters' : hasFilters ? 'Filters active' : 'Filters'}</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={(value) => { setQuery(value); setLimit(maxVisible); }}
        placeholder="Name, muscle or equipment"
        placeholderTextColor="#71717A"
        accessibilityLabel="Search exercises"
        style={styles.textInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {filtersOpen ? (
        <View style={{ gap: 8, marginTop: 12 }}>
          <View style={styles.chipRow}>
            {getMuscleFilters(exercises).map((item) => (
              <Pressable key={item} style={[styles.chip, muscle === item ? styles.chipActive : null]} onPress={() => { setMuscle(item); setLimit(maxVisible); }}>
                <Text style={styles.chipText}>{item === allMusclesFilter ? 'All muscles' : formatMuscleGroup(item)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            {getEquipmentFilters(exercises).map((item) => (
              <Pressable key={item} style={[styles.chip, equipment === item ? styles.chipActive : null]} onPress={() => { setEquipment(item); setLimit(maxVisible); }}>
                <Text style={styles.chipText}>{item === allEquipmentFilter ? 'All equipment' : formatEquipment(item)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={styles.rowMuted}>{visible.length} matching exercises</Text>
      <View style={[styles.libraryList, { marginTop: 10 }]}>
        {visible.slice(0, limit).map((exercise) => (
          <Pressable key={exercise.id} style={[styles.libraryRow, selectedId === exercise.id ? styles.libraryRowActive : null]} onPress={() => onSelect(exercise.id)}>
            <View style={styles.exerciseBody}>
              <Text style={styles.rowTitle}>{exercise.name}</Text>
              <Text style={styles.rowMuted}>{formatMuscleGroup(exercise.primaryMuscle)} · {formatEquipment(exercise.equipment)}</Text>
            </View>
            <Text style={styles.rowValue}>{actionLabel ?? (selectedId === exercise.id ? 'Selected' : 'View')}</Text>
          </Pressable>
        ))}
      </View>
      {visible.length === 0 ? <Text style={styles.compactText}>No exercises match. Try another name or clear the filters.</Text> : null}
      {visible.length > limit ? (
        <Pressable style={styles.secondaryFull} onPress={() => setLimit(limit + maxVisible)}>
          <Text style={styles.secondaryText}>Show more ({visible.length - limit})</Text>
        </Pressable>
      ) : null}
      {hasFilters ? (
        <Pressable style={styles.secondaryFull} onPress={() => { setMuscle(allMusclesFilter); setEquipment(allEquipmentFilter); setLimit(maxVisible); }}>
          <Text style={styles.secondaryText}>Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
