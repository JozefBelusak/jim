import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '../components/BottomSheet';
import { DisclosureSection } from '../components/DisclosureSection';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { PlanNumberField } from '../components/PlanNumberField';
import { SavingIndicator } from '../components/SavingIndicator';
import { findStarterTemplate, starterTemplateDefinitions } from '../data/starterTemplates';
import { getExerciseMetric } from '../domain/metrics';
import { SavingStatus } from '../storage/useTrainingState';
import { colors, styles } from '../theme/styles';
import { Exercise, TemplateExercise, WorkoutTemplate } from '../types';

type ExercisePatch = Partial<Omit<TemplateExercise, 'id' | 'exerciseId' | 'order'>>;
type TemplatesScreenProps = {
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  userId: string;
  savingStatus: SavingStatus;
  savingError: string | null;
  onRetrySave: () => void;
  onCreate: () => WorkoutTemplate;
  onUpdateDetails: (templateId: string, patch: { name?: string; description?: string }) => void;
  onDuplicate: (templateId: string) => WorkoutTemplate;
  onAddExercise: (templateId: string, exerciseId: string) => void;
  onUpdateExercise: (templateId: string, templateExerciseId: string, patch: ExercisePatch) => void;
  onRemoveExercise: (templateId: string, templateExerciseId: string) => void;
  onMoveExercise: (templateId: string, templateExerciseId: string, direction: -1 | 1) => void;
  onStart: (template: WorkoutTemplate) => void;
  onArchive: (templateId: string, archived: boolean) => void;
  onDelete: (templateId: string) => void;
  onAddStarter: (index: number) => WorkoutTemplate;
  onMoveTemplate?: (templateId: string, direction: -1 | 1) => void;
};

export function TemplatesScreen({ templates, exercises, userId, savingStatus, savingError, onRetrySave, onCreate, onUpdateDetails, onDuplicate, onAddExercise, onUpdateExercise, onRemoveExercise, onMoveExercise, onStart, onArchive, onDelete, onAddStarter, onMoveTemplate }: TemplatesScreenProps) {
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [addingExercise, setAddingExercise] = useState(false);
  const [startersOpen, setStartersOpen] = useState(false);
  const visibleTemplates = templates.filter((template) => Boolean(template.archived) === showArchived);
  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;
  const closeEditor = () => { setEditingTemplateId(null); setAddingExercise(false); };

  return <View style={styles.screen}>
    <Pressable style={styles.primaryWide} accessibilityRole="button" onPress={() => setEditingTemplateId(onCreate().id)}><Text style={styles.primaryText}>Create plan</Text></Pressable>
    <Pressable style={[styles.secondaryFull, local.noMargin]} accessibilityRole="button" onPress={() => setStartersOpen(true)}><Text style={styles.secondaryText}>Browse starter plans</Text></Pressable>
    <View style={styles.chipRow}>
      <Pressable style={[styles.chip, !showArchived ? styles.chipActive : null]} accessibilityRole="button" accessibilityState={{ selected: !showArchived }} onPress={() => setShowArchived(false)}><Text style={styles.chipText}>Active ({templates.filter((template) => !template.archived).length})</Text></Pressable>
      <Pressable style={[styles.chip, showArchived ? styles.chipActive : null]} accessibilityRole="button" accessibilityState={{ selected: showArchived }} onPress={() => setShowArchived(true)}><Text style={styles.chipText}>Archived ({templates.filter((template) => template.archived).length})</Text></Pressable>
    </View>
    {visibleTemplates.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>{showArchived ? 'No archived plans' : 'No plans yet'}</Text><Text style={styles.compactText}>Choose a starter plan or create a workout you can use again.</Text></View> : null}
    <View style={styles.libraryList}>
      {visibleTemplates.map((template, index) => <View key={template.id} style={styles.planQuickCard}>
        <Text style={styles.cardTitle}>{template.name}</Text>
        <Text style={styles.rowMuted}>{template.exercises.length} exercises · {countTargetSets(template)} target sets{template.archived ? ' · archived' : ''}</Text>
        <View style={styles.planQuickActions}>
          <Pressable style={styles.planEditButton} accessibilityRole="button" accessibilityLabel={`Edit ${template.name}`} onPress={() => setEditingTemplateId(template.id)}><Text style={styles.secondaryText}>Edit</Text></Pressable>
          <Pressable disabled={template.exercises.length === 0} style={[styles.planStartButton, !template.exercises.length ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`Start ${template.name}`} onPress={() => onStart(template)}><Text style={styles.primaryText}>Start</Text></Pressable>
        </View>
        <DisclosureSection title="Manage plan" summary={showArchived ? 'Restore or delete' : 'Order, archive or delete'}>
          {!showArchived && onMoveTemplate ? <>
            <Text style={styles.rowMuted}>Workout rotation · {index + 1} of {visibleTemplates.length}</Text>
            <View style={local.actions}>
              <Pressable disabled={index === 0} style={[styles.smallButton, index === 0 ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`Move ${template.name} up`} onPress={() => onMoveTemplate(template.id, -1)}><Text style={styles.smallButtonText}>Move up</Text></Pressable>
              <Pressable disabled={index === visibleTemplates.length - 1} style={[styles.smallButton, index === visibleTemplates.length - 1 ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`Move ${template.name} down`} onPress={() => onMoveTemplate(template.id, 1)}><Text style={styles.smallButtonText}>Move down</Text></Pressable>
            </View>
          </> : null}
          <View style={local.actions}>
            <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => onArchive(template.id, !template.archived)}><Text style={styles.smallButtonText}>{template.archived ? 'Restore' : 'Archive'}</Text></Pressable>
            <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => setDeleteTemplateId(template.id)}><Text style={styles.dangerOutlineText}>Delete</Text></Pressable>
          </View>
          {deleteTemplateId === template.id ? <View style={local.confirmation}>
            <Text style={styles.rowMuted}>Delete “{template.name}”? Completed workouts stay in your history.</Text>
            <Pressable style={styles.dangerOutlineFull} accessibilityRole="button" onPress={() => { onDelete(template.id); setDeleteTemplateId(null); }}><Text style={styles.dangerOutlineText}>Confirm delete</Text></Pressable>
            <Pressable style={[styles.secondaryFull, local.noMargin]} accessibilityRole="button" onPress={() => setDeleteTemplateId(null)}><Text style={styles.secondaryText}>Keep plan</Text></Pressable>
          </View> : null}
        </DisclosureSection>
      </View>)}
    </View>

    <BottomSheet visible={Boolean(editingTemplate) && !addingExercise} title="Edit plan" subtitle="Changes save automatically as you edit." onClose={closeEditor} footer={<View style={local.footer}>
      <SavingIndicator status={savingStatus} error={savingError} onRetry={onRetrySave} />
      <View style={local.actions}>
        <Pressable style={[styles.templateSecondaryAction, local.footerButton]} accessibilityRole="button" onPress={() => setAddingExercise(true)}><Text style={styles.secondaryText}>+ Add exercise</Text></Pressable>
        <Pressable style={[styles.templatePrimaryAction, local.footerButton]} accessibilityRole="button" onPress={closeEditor}><Text style={styles.primaryText}>Done</Text></Pressable>
      </View>
    </View>}>
      {editingTemplate ? <TemplateEditor key={editingTemplate.id} template={editingTemplate} exercises={exercises}
        onUpdateDetails={(patch) => onUpdateDetails(editingTemplate.id, patch)}
        onDuplicate={() => setEditingTemplateId(onDuplicate(editingTemplate.id).id)}
        onUpdateExercise={(id, patch) => onUpdateExercise(editingTemplate.id, id, patch)}
        onRemoveExercise={(id) => onRemoveExercise(editingTemplate.id, id)}
        onMoveExercise={(id, direction) => onMoveExercise(editingTemplate.id, id, direction)} /> : null}
    </BottomSheet>

    <BottomSheet visible={Boolean(editingTemplate) && addingExercise} title="Add exercise to plan" subtitle={editingTemplate?.name} onClose={() => setAddingExercise(false)} footer={<Pressable style={[styles.secondaryFull, local.noMargin]} accessibilityRole="button" onPress={() => setAddingExercise(false)}><Text style={styles.secondaryText}>Back to plan</Text></Pressable>}>
      <ExerciseSearch title="Find exercise" exercises={exercises} actionLabel="Add" maxVisible={5} onSelect={(id) => { if (editingTemplate) onAddExercise(editingTemplate.id, id); setAddingExercise(false); }} />
    </BottomSheet>

    <BottomSheet visible={startersOpen} title="Starter plans" subtitle="Choose one plan. You can change it afterwards." onClose={() => setStartersOpen(false)}>
      {starterTemplateDefinitions.map((starter, index) => {
        const existing = findStarterTemplate(templates, userId, index);
        return <View key={starter.key} style={styles.planQuickCard}>
          <Text style={styles.rowTitle}>{starter.name}</Text>
          <Text style={styles.compactText}>{starter.description}</Text>
          <Text style={styles.rowMuted}>{starter.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)?.name ?? id).join(' · ')}</Text>
          <Pressable disabled={Boolean(existing && !existing.archived)} style={[styles.secondaryFull, existing && !existing.archived ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`${existing?.archived ? 'Restore' : existing ? 'Already added' : 'Add'} ${starter.name}`} onPress={() => { const template = onAddStarter(index); setStartersOpen(false); setShowArchived(false); setEditingTemplateId(template.id); }}><Text style={styles.secondaryText}>{existing?.archived ? 'Restore plan' : existing ? 'Already added' : 'Add this plan'}</Text></Pressable>
        </View>;
      })}
    </BottomSheet>
  </View>;
}

function countTargetSets(template: WorkoutTemplate) {
  return template.exercises.reduce((sum, exercise) => sum + (exercise.targetSets ?? 3), 0);
}

function TemplateEditor({ template, exercises, onUpdateDetails, onDuplicate, onUpdateExercise, onRemoveExercise, onMoveExercise }: {
  template: WorkoutTemplate; exercises: Exercise[];
  onUpdateDetails: (patch: { name?: string; description?: string }) => void;
  onDuplicate: () => void;
  onUpdateExercise: (id: string, patch: ExercisePatch) => void;
  onRemoveExercise: (id: string) => void;
  onMoveExercise: (id: string, direction: -1 | 1) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [removeId, setRemoveId] = useState<string | null>(null);
  return <View style={styles.screen}>
    <View style={local.field}>
      <Text style={styles.rowMuted}>Plan name</Text>
      <TextInput value={name} accessibilityLabel="Plan name" placeholder="Plan name" placeholderTextColor={colors.muted} style={[styles.textInput, local.noMargin]} onChangeText={(value) => { setName(value); if (value.trim()) onUpdateDetails({ name: value }); }} onBlur={() => { if (!name.trim()) setName(template.name); }} />
      {!name.trim() ? <Text accessibilityRole="alert" style={styles.dangerOutlineText}>A name is required. Your last valid name is kept until you enter a new one.</Text> : null}
    </View>
    <DisclosureSection title="Plan description" summary={template.description || 'Optional notes about this plan'}>
      <TextInput value={description} accessibilityLabel="Plan description" placeholder="What is this plan for?" placeholderTextColor={colors.muted} style={[styles.noteInput, local.noMargin]} multiline onChangeText={(value) => { setDescription(value); onUpdateDetails({ description: value }); }} />
    </DisclosureSection>
    <Text style={styles.rowMuted}>{template.exercises.length ? 'Tap Targets & rest to change an exercise.' : 'Use + Add exercise below to build your plan.'}</Text>
    {template.exercises.map((item, index) => {
      const exercise = exercises.find((candidate) => candidate.id === item.exerciseId);
      if (!exercise) return null;
      const timed = getExerciseMetric(exercise) === 'duration' || getExerciseMetric(exercise) === 'distance_duration';
      const unit = timed ? 'sec' : 'reps';
      const field = (label: string, key: 'targetSets' | 'repRangeMin' | 'repRangeMax' | 'restSeconds' | 'targetRir', value: number | undefined, minimum = 1, optional = false, maximum = Number.MAX_SAFE_INTEGER) => <PlanNumberField label={label} accessibilityLabel={`${label} for ${exercise.name} ${index + 1}`} value={value} minimum={minimum} maximum={maximum} optional={optional} onCommit={(number) => onUpdateExercise(item.id, { [key]: number })} />;
      return <View key={item.id} style={styles.card}>
        <Text style={styles.rowTitle}>{index + 1}. {exercise.name}</Text>
        <DisclosureSection title="Targets & rest" summary={`${item.targetSets ?? 3} sets · ${item.repRangeMin ?? 8}–${item.repRangeMax ?? 12} ${unit} · ${item.restSeconds ?? 90}s rest${item.targetRir !== undefined ? ` · RIR ${item.targetRir}` : ''}`}>
          <View style={local.numberRow}>
            {field('Sets', 'targetSets', item.targetSets ?? 3)}
            {field(`Min ${unit}`, 'repRangeMin', item.repRangeMin ?? 8)}
            {field(`Max ${unit}`, 'repRangeMax', item.repRangeMax ?? 12)}
          </View>
          <View style={local.numberRow}>
            {field('Rest sec', 'restSeconds', item.restSeconds ?? 90, 0)}
            {field('Target RIR', 'targetRir', item.targetRir, 0, true, 10)}
          </View>
          <TextInput value={item.notes ?? ''} accessibilityLabel={`Notes for ${exercise.name} ${index + 1}`} onChangeText={(notes) => onUpdateExercise(item.id, { notes })} placeholder="Setup or technique cues" placeholderTextColor={colors.muted} style={[styles.compactNoteInput, local.noMargin]} multiline />
          <View style={local.actions}>
            <Pressable disabled={index === 0} style={[styles.smallButton, index === 0 ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} ${index + 1} up in plan`} onPress={() => onMoveExercise(item.id, -1)}><Text style={styles.smallButtonText}>Move up</Text></Pressable>
            <Pressable disabled={index === template.exercises.length - 1} style={[styles.smallButton, index === template.exercises.length - 1 ? styles.disabledButton : null]} accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} ${index + 1} down in plan`} onPress={() => onMoveExercise(item.id, 1)}><Text style={styles.smallButtonText}>Move down</Text></Pressable>
            <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => setRemoveId(item.id)}><Text style={styles.dangerOutlineText}>Remove</Text></Pressable>
          </View>
          {removeId === item.id ? <View style={local.confirmation}>
            <Text style={styles.rowMuted}>Remove {exercise.name} and its targets from this plan?</Text>
            <View style={local.actions}>
              <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => { onRemoveExercise(item.id); setRemoveId(null); }}><Text style={styles.dangerOutlineText}>Remove exercise</Text></Pressable>
              <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => setRemoveId(null)}><Text style={styles.smallButtonText}>Keep exercise</Text></Pressable>
            </View>
          </View> : null}
        </DisclosureSection>
      </View>;
    })}
    <Pressable style={[styles.secondaryFull, local.noMargin]} accessibilityRole="button" onPress={onDuplicate}><Text style={styles.secondaryText}>Duplicate plan</Text></Pressable>
  </View>;
}

const local = StyleSheet.create({
  noMargin: { marginTop: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { gap: 10 },
  footerButton: { minWidth: 100, minHeight: 44 },
  confirmation: { gap: 10, paddingTop: 8 },
  field: { gap: 6 },
  numberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
