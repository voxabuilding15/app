import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import {
  Button,
  CategorySection,
  EmptyState,
  FormSection,
  IconButton,
  Input,
  NameColorSheet,
  Screen,
  SegmentedControl,
  Text,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';

import type { Priority } from '../../domain/entities';
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH } from '../../domain/validation';
import { DueSection } from '../components/DueSection';
import { ReminderSection } from '../components/ReminderSection';
import { RepeatSection } from '../components/RepeatSection';
import { SubtasksSection } from '../components/SubtasksSection';
import { LabelSection } from '../components/TaxonomySections';
import { PRIORITY_LABEL } from '../format';
import type { TaskDraft } from '../../domain/validation';
import {
  useTaskFormViewModel,
  useTaskLoader,
  type TaskStatus,
} from '../view-models/useTaskFormViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

const PRIORITY_OPTIONS = (['low', 'medium', 'high'] as const).map((value) => ({
  value,
  label: PRIORITY_LABEL[value],
}));

interface TaskFormScreenProps {
  /** Null creates a new task. */
  taskId: string | null;
}

export function TaskFormScreen({ taskId }: TaskFormScreenProps) {
  useHideTabBar();
  const { colors } = useTheme();
  const load = useTaskLoader(taskId);
  const title = taskId === null ? 'New task' : 'Edit task';

  if (load.phase === 'ready') {
    return <TaskFormBody taskId={taskId} initial={load.initial} status={load.status} />;
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {load.phase === 'loading' ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading task"
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? 'Task not found' : "Couldn't load the task"}
            message={
              load.phase === 'notFound'
                ? 'This task may have been deleted.'
                : 'Your data is safe on this device. Try again.'
            }
            actionLabel={load.phase === 'failed' ? 'Try again' : undefined}
            onAction={load.phase === 'failed' ? load.retry : undefined}
          />
        </Screen>
      )}
    </>
  );
}

interface TaskFormBodyProps {
  taskId: string | null;
  initial: TaskDraft;
  status: TaskStatus | null;
}

function TaskFormBody({ taskId, initial, status }: TaskFormBodyProps) {
  const { width } = useWindowDimensions();
  const vm = useTaskFormViewModel(taskId, initial);
  const [creating, setCreating] = useState<'category' | 'label' | null>(null);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const headerRight = vm.isEditing
    ? () => (
        <View style={{ flexDirection: 'row' }}>
          {status === 'archived' ? (
            <IconButton icon="unarchive" label="Restore task" onPress={() => void vm.restore()} />
          ) : (
            <IconButton icon="archive" label="Archive task" onPress={() => void vm.archive()} />
          )}
          <IconButton icon="delete" label="Delete task" onPress={vm.confirmDelete} />
        </View>
      )
    : undefined;

  const options = (
    <Stack.Screen options={{ title: vm.isEditing ? 'Edit task' : 'New task', headerRight }} />
  );

  const details = (
    <>
      <FormSection title="Details">
        <Input
          label="Title"
          value={draft.title}
          onChangeText={vm.setTitle}
          error={errors.title}
          maxLength={TITLE_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label="Notes"
          value={draft.notes}
          onChangeText={vm.setNotes}
          error={errors.notes}
          maxLength={NOTES_MAX_LENGTH}
          multiline
        />
      </FormSection>
      <SubtasksSection
        subtasks={draft.subtasks}
        error={errors.subtasks}
        onAdd={vm.addSubtask}
        onRename={vm.renameSubtask}
        onToggle={vm.toggleSubtask}
        onRemove={vm.removeSubtask}
      />
    </>
  );

  const scheduling = (
    <>
      <FormSection title="Priority">
        <SegmentedControl<Priority>
          options={PRIORITY_OPTIONS}
          value={draft.priority}
          onChange={vm.setPriority}
        />
      </FormSection>
      <DueSection
        due={draft.due}
        error={errors.due}
        onQuickDate={vm.setQuickDate}
        onChooseDate={() => void vm.chooseDate()}
        onChooseTime={() => void vm.chooseTime()}
        onClearTime={vm.clearTime}
        onClear={vm.clearDue}
      />
      {draft.due !== null ? (
        <>
          <ReminderSection
            due={draft.due}
            offsetMinutes={draft.reminderOffsetMinutes}
            isAlarm={draft.isAlarm}
            error={errors.reminder}
            onOffset={vm.setReminderOffset}
            onAlarm={vm.setAlarm}
          />
          <RepeatSection
            rule={draft.repeat}
            error={errors.repeat}
            onPreset={vm.setRepeatPreset}
            onChange={vm.changeRepeat}
          />
        </>
      ) : null}
      <CategorySection
        categories={vm.categories}
        selectedId={draft.categoryId}
        onSelect={vm.setCategory}
        onCreate={() => setCreating('category')}
      />
      <LabelSection
        labels={vm.labels}
        selectedIds={draft.labelIds}
        onToggle={vm.toggleLabel}
        onCreate={() => setCreating('label')}
      />
    </>
  );

  return (
    <>
      {options}
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {status === 'archived' || status === 'completed' ? (
          <Text tone="muted" accessibilityRole="alert">
            {status === 'archived' ? 'This task is archived.' : 'This task is completed.'}
          </Text>
        ) : null}
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{details}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{scheduling}</View>
          </View>
        ) : (
          <>
            {details}
            {scheduling}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? 'Save changes' : 'Create task'}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
      </Screen>

      {creating !== null ? (
        <NameColorSheet
          title={creating === 'category' ? 'New category' : 'New label'}
          initialName=""
          initialColor={ACCENT_COLORS[0]}
          onSave={async (name, color) => {
            const error = await vm.createTaxonomy(creating, name, color);
            if (error === null) {
              setCreating(null);
            }
            return error;
          }}
          onClose={() => setCreating(null)}
        />
      ) : null}
    </>
  );
}
