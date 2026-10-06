import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Stepper } from '../components/ui';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { formatMuscleGroup } from '../domain/exercises';
import { getExerciseMetric } from '../domain/metrics';
import { styles } from '../theme/styles';
import { Exercise, TemplateExercise, WorkoutTemplate } from '../types';

type TemplatesScreenProps = {
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  onCreate: () => WorkoutTemplate;
  onUpdateDetails: (templateId: string, patch: { name?: string; description?: string }) => void;
  onDuplicate: (templateId: string) => WorkoutTemplate;
  onAddExercise: (templateId: string, exerciseId: string) => void;
  onUpdateExercise: (
    templateId: string,
    templateExerciseId: string,
    patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>,
  ) => void;
  onRemoveExercise: (templateId: string, templateExerciseId: string) => void;
  onMoveExercise: (templateId: string, templateExerciseId: string, direction: -1 | 1) => void;
  onStart: (template: WorkoutTemplate) => void;
  onArchive: (templateId: string, archived: boolean) => void;
  onDelete: (templateId: string) => void;
  onAddStarters: () => void;
  onMoveTemplate?: (templateId: string, direction: -1 | 1) => void;
};

export function TemplatesScreen({
  templates,
  exercises,
  onCreate,
  onUpdateDetails,
  onDuplicate,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onMoveExercise,
  onStart,
  onArchive,
  onDelete,
  onAddStarters,
  onMoveTemplate,
}: TemplatesScreenProps) {
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const visibleTemplates = templates.filter((template) => Boolean(template.archived) === showArchived);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const editingTemplate =
    templates.find((template) => template.id === editingTemplateId) ?? null;

  function createTemplate() {
    const template = onCreate();
    setEditingTemplateId(template.id);
  }

  function duplicateTemplate(templateId: string) {
    const duplicate = onDuplicate(templateId);
    setEditingTemplateId(duplicate.id);
  }

  return (
    <View style={styles.screen}>
      <Pressable style={styles.primaryWide} onPress={createTemplate}>
        <Text style={styles.primaryText}>CREATE TEMPLATE</Text>
      </Pressable>

      <View style={styles.chipRow}>
        <Pressable style={[styles.chip, !showArchived ? styles.chipActive : null]} onPress={() => setShowArchived(false)}><Text style={styles.chipText}>Active ({templates.filter((template) => !template.archived).length})</Text></Pressable>
        <Pressable style={[styles.chip, showArchived ? styles.chipActive : null]} onPress={() => setShowArchived(true)}><Text style={styles.chipText}>Archived ({templates.filter((template) => template.archived).length})</Text></Pressable>
      </View>
      <Pressable style={styles.secondaryFull} onPress={onAddStarters}><Text style={styles.secondaryText}>Add starter plans</Text></Pressable>

      {visibleTemplates.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{showArchived ? 'No archived plans' : 'No workout templates yet'}</Text>
          <Text style={styles.compactText}>Create a reusable workout such as Push, Pull, or Legs.</Text>
        </View>
      ) : null}

      <View style={styles.libraryList}>
        {visibleTemplates.map((template, index) => (
          <View key={template.id} style={styles.planQuickCard}>
            <View style={styles.rowBetween}>
              <View style={styles.exerciseBody}>
                <Text style={styles.cardTitle}>{template.name}</Text>
                <Text style={styles.rowMuted}>
                  {template.exercises.length} exercises · {countTargetSets(template)} target sets
                </Text>
              </View>
              <Text style={styles.rowValue}>{template.archived ? 'Archived' : 'Ready'}</Text>
            </View>
            <View style={styles.planQuickActions}>
              <Pressable
                style={styles.planEditButton}
                onPress={() => setEditingTemplateId(template.id)}
              >
                <Text style={styles.secondaryText}>Edit</Text>
              </Pressable>
              <Pressable
                disabled={template.exercises.length === 0}
                style={[
                  styles.planStartButton,
                  template.exercises.length === 0 ? styles.disabledButton : null,
                ]}
                onPress={() => onStart(template)}
              >
                <Text style={styles.primaryText}>Start</Text>
              </Pressable>
            </View>
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              <Pressable style={styles.smallButton} onPress={() => onArchive(template.id, !template.archived)}><Text style={styles.smallButtonText}>{template.archived ? 'Restore' : 'Archive'}</Text></Pressable>
              <Pressable style={styles.smallButton} onPress={() => setDeleteTemplateId(template.id)}><Text style={styles.dangerOutlineText}>Delete</Text></Pressable>
              {!showArchived && onMoveTemplate ? (
                <>
                  <Pressable disabled={index === 0} style={[styles.smallButton, index === 0 ? styles.disabledButton : null]} onPress={() => onMoveTemplate(template.id, -1)}><Text style={styles.smallButtonText}>↑ Rotation</Text></Pressable>
                  <Pressable disabled={index === visibleTemplates.length - 1} style={[styles.smallButton, index === visibleTemplates.length - 1 ? styles.disabledButton : null]} onPress={() => onMoveTemplate(template.id, 1)}><Text style={styles.smallButtonText}>↓ Rotation</Text></Pressable>
                </>
              ) : null}
            </View>
            {deleteTemplateId === template.id ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>Delete “{template.name}”? Your completed workout history will stay available.</Text>
                <Pressable style={styles.dangerOutlineFull} onPress={() => { onDelete(template.id); setDeleteTemplateId(null); if (editingTemplateId === template.id) setEditingTemplateId(null); }}><Text style={styles.dangerOutlineText}>Confirm delete</Text></Pressable>
                <Pressable style={styles.secondaryFull} onPress={() => setDeleteTemplateId(null)}><Text style={styles.secondaryText}>Keep plan</Text></Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {editingTemplate ? (
        <View style={styles.screen}>
          <View style={styles.rowBetween}>
            <View style={styles.exerciseDetailTitle}>
              <Text style={styles.eyebrow}>Editing plan</Text>
              <Text style={styles.cardTitle}>{editingTemplate.name}</Text>
            </View>
            <Pressable style={styles.smallButton} onPress={() => setEditingTemplateId(null)}>
              <Text style={styles.smallButtonText}>Close</Text>
            </Pressable>
          </View>
          <TemplateEditor
            key={editingTemplate.id}
            template={editingTemplate}
            exercises={exercises}
            onUpdateDetails={(patch) => onUpdateDetails(editingTemplate.id, patch)}
            onDuplicate={() => duplicateTemplate(editingTemplate.id)}
            onAddExercise={(exerciseId) => onAddExercise(editingTemplate.id, exerciseId)}
            onUpdateExercise={(templateExerciseId, patch) =>
              onUpdateExercise(editingTemplate.id, templateExerciseId, patch)
            }
            onRemoveExercise={(templateExerciseId) =>
              onRemoveExercise(editingTemplate.id, templateExerciseId)
            }
            onMoveExercise={(templateExerciseId, direction) =>
              onMoveExercise(editingTemplate.id, templateExerciseId, direction)
            }
            onStart={() => onStart(editingTemplate)}
          />
        </View>
      ) : null}
    </View>
  );
}

function countTargetSets(template: WorkoutTemplate) {
  return template.exercises.reduce((sum, exercise) => sum + (exercise.targetSets ?? 3), 0);
}

function TemplateEditor({
  template,
  exercises,
  onUpdateDetails,
  onDuplicate,
  onAddExercise,
  onUpdateExercise,
  onRemoveExercise,
  onMoveExercise,
  onStart,
}: {
  template: WorkoutTemplate;
  exercises: Exercise[];
  onUpdateDetails: (patch: { name?: string; description?: string }) => void;
  onDuplicate: () => void;
  onAddExercise: (exerciseId: string) => void;
  onUpdateExercise: (
    templateExerciseId: string,
    patch: Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>,
  ) => void;
  onRemoveExercise: (templateExerciseId: string) => void;
  onMoveExercise: (templateExerciseId: string, direction: -1 | 1) => void;
  onStart: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Template details</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Template name"
          placeholderTextColor="#71717A"
          style={styles.textInput}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor="#71717A"
          style={styles.noteInput}
          multiline
        />
        <Pressable
          disabled={!name.trim()}
          style={[styles.secondaryFull, !name.trim() ? styles.disabledButton : null]}
          onPress={() => onUpdateDetails({ name, description })}
        >
          <Text style={styles.secondaryText}>Save details</Text>
        </Pressable>
        <View style={styles.templateActions}>
          <Pressable style={styles.templateSecondaryAction} onPress={onDuplicate}>
            <Text style={styles.secondaryText}>Duplicate</Text>
          </Pressable>
          <Pressable
            disabled={template.exercises.length === 0}
            style={[
              styles.templatePrimaryAction,
              template.exercises.length === 0 ? styles.disabledButton : null,
            ]}
            onPress={onStart}
          >
            <Text style={styles.primaryText}>Start workout</Text>
          </Pressable>
        </View>
      </View>

      <ExerciseSearch title="Add exercise" exercises={exercises} onSelect={onAddExercise} actionLabel="Add" maxVisible={5} />

      {template.exercises.map((item, index) => {
        const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
        if (!exercise) {
          return null;
        }

        const rangeUnit = getExerciseMetric(exercise) === 'duration' || getExerciseMetric(exercise) === 'distance_duration' ? 'sec' : 'reps';
        return (
          <View key={item.id} style={styles.exerciseBlock}>
            <View style={styles.exerciseRow}>
              <View style={styles.exerciseNumber}>
                <Text style={styles.exerciseNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.exerciseBody}>
                <Text style={styles.rowTitle}>{exercise.name}</Text>
                <Text style={styles.rowMuted}>{formatMuscleGroup(exercise.primaryMuscle)}</Text>
              </View>
            </View>
            <View style={styles.planEditor}>
              <View style={styles.stepperRow}>
                <Stepper
                  label="Sets"
                  value={`${item.targetSets ?? 3}`}
                  onMinus={() => onUpdateExercise(item.id, { targetSets: Math.max(1, (item.targetSets ?? 3) - 1) })}
                  onPlus={() => onUpdateExercise(item.id, { targetSets: (item.targetSets ?? 3) + 1 })}
                />
                <Stepper
                  label={`Min ${rangeUnit}`}
                  value={`${item.repRangeMin ?? 8}`}
                  onMinus={() => onUpdateExercise(item.id, { repRangeMin: Math.max(1, (item.repRangeMin ?? 8) - 1) })}
                  onPlus={() => onUpdateExercise(item.id, { repRangeMin: (item.repRangeMin ?? 8) + 1 })}
                />
                <Stepper
                  label={`Max ${rangeUnit}`}
                  value={`${item.repRangeMax ?? 12}`}
                  onMinus={() => onUpdateExercise(item.id, { repRangeMax: Math.max(1, (item.repRangeMax ?? 12) - 1) })}
                  onPlus={() => onUpdateExercise(item.id, { repRangeMax: (item.repRangeMax ?? 12) + 1 })}
                />
              </View>
              <View style={styles.stepperRow}>
                <Stepper
                  label="Rest sec"
                  value={`${item.restSeconds ?? 90}`}
                  onMinus={() => onUpdateExercise(item.id, { restSeconds: Math.max(0, (item.restSeconds ?? 90) - 30) })}
                  onPlus={() => onUpdateExercise(item.id, { restSeconds: (item.restSeconds ?? 90) + 30 })}
                />
                <Stepper label="Target RIR" value={item.targetRir === undefined ? 'Off' : `${item.targetRir}`} onMinus={() => onUpdateExercise(item.id, { targetRir: item.targetRir === undefined ? 2 : item.targetRir === 0 ? undefined : item.targetRir - 1 })} onPlus={() => onUpdateExercise(item.id, { targetRir: Math.min(10, (item.targetRir ?? 1) + 1) })} />
              </View>
              <TextInput value={item.notes ?? ''} onChangeText={(notes) => onUpdateExercise(item.id, { notes })} placeholder="Exercise notes, setup or technique cues" placeholderTextColor="#71717A" style={styles.compactNoteInput} multiline />
              <View style={styles.editorActions}>
                <Pressable
                  disabled={index === 0}
                  style={[styles.reorderButton, index === 0 ? styles.disabledButton : null]}
                  onPress={() => onMoveExercise(item.id, -1)}
                >
                  <Text style={styles.reorderText}>Move up</Text>
                </Pressable>
                <Pressable
                  disabled={index === template.exercises.length - 1}
                  style={[
                    styles.reorderButton,
                    index === template.exercises.length - 1 ? styles.disabledButton : null,
                  ]}
                  onPress={() => onMoveExercise(item.id, 1)}
                >
                  <Text style={styles.reorderText}>Move down</Text>
                </Pressable>
                <Pressable style={styles.removeButton} onPress={() => onRemoveExercise(item.id)}>
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

    </View>
  );
}
