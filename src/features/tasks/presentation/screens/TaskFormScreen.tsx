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
  RepeatSection,
  Screen,
  SegmentedControl,
  Text,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { Priority } from '../../domain/entities';
import { TASK_REPEAT_PRESETS, TASK_REPEAT_UNITS } from '../../domain/repeat';
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH } from '../../domain/validation';
import { DueSection } from '../components/DueSection';
import { ReminderSection } from '../components/ReminderSection';
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
  const { t } = useTranslator();
  useHideTabBar();
  const { colors } = useTheme();
  const load = useTaskLoader(taskId);
  const title = taskId === null ? t('New task') : t('Edit task');

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
            accessibilityLabel={t('Loading task')}
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? t('Task not found') : t("Couldn't load the task")}
            message={
              load.phase === 'notFound'
                ? t('This task may have been deleted.')
                : t('Your data is safe on this device. Try again.')
            }
            actionLabel={load.phase === 'failed' ? t('Try again') : undefined}
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
  const { t } = useTranslator();
  const { width } = useWindowDimensions();
  const vm = useTaskFormViewModel(taskId, initial);
  const [creating, setCreating] = useState<'category' | 'label' | null>(null);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const headerRight = vm.isEditing
    ? () => (
        <View style={{ flexDirection: 'row' }}>
          {status === 'archived' ? (
            <IconButton
              icon="unarchive"
              label={t('Restore task')}
              onPress={() => void vm.restore()}
            />
          ) : (
            <IconButton
              icon="archive"
              label={t('Archive task')}
              onPress={() => void vm.archive()}
            />
          )}
          <IconButton icon="delete" label={t('Delete task')} onPress={vm.confirmDelete} />
        </View>
      )
    : undefined;

  const options = (
    <Stack.Screen options={{ title: vm.isEditing ? t('Edit task') : t('New task'), headerRight }} />
  );

  const details = (
    <>
      <FormSection title={t('Details')}>
        <Input
          label={t('Title')}
          value={draft.title}
          onChangeText={vm.setTitle}
          error={errors.title}
          maxLength={TITLE_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label={t('Notes')}
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
      <FormSection title={t('Priority')}>
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
            presets={TASK_REPEAT_PRESETS}
            units={TASK_REPEAT_UNITS}
            error={errors.repeat}
            onPreset={vm.setRepeatPreset}
            onChange={vm.changeRepeat}
            hint={t('Completing the task creates the next one automatically.')}
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
            {status === 'archived' ? t('This task is archived.') : t('This task is completed.')}
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
          label={vm.isEditing ? t('Save changes') : t('Create task')}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
      </Screen>

      {creating !== null ? (
        <NameColorSheet
          title={creating === 'category' ? t('New category') : t('New label')}
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
