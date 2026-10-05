import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import {
  Button,
  CategorySection,
  EmptyState,
  FormSection,
  Input,
  NameColorSheet,
  Screen,
  Text,
} from '@/components';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';

import {
  HABIT_NAME_MAX_LENGTH,
  HABIT_NOTES_MAX_LENGTH,
  type HabitDraft,
} from '../../domain/validation';
import {
  AppearanceSection,
  FrequencySection,
  HabitReminderSection,
} from '../components/HabitFormSections';
import { useHabitFormViewModel, useHabitLoader } from '../view-models/useHabitFormViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

interface HabitFormScreenProps {
  /** Null creates a new habit. */
  habitId: string | null;
}

export function HabitFormScreen({ habitId }: HabitFormScreenProps) {
  useHideTabBar();
  const { colors } = useTheme();
  const load = useHabitLoader(habitId, ACCENT_COLORS[0]);
  const title = habitId === null ? 'New habit' : 'Edit habit';

  if (load.phase === 'ready') {
    return <HabitFormBody habitId={habitId} initial={load.initial} />;
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
            accessibilityLabel="Loading habit"
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? 'Habit not found' : "Couldn't load the habit"}
            message={
              load.phase === 'notFound'
                ? 'This habit may have been deleted.'
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

function HabitFormBody({ habitId, initial }: { habitId: string | null; initial: HabitDraft }) {
  const { width } = useWindowDimensions();
  const vm = useHabitFormViewModel(habitId, initial);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const basics = (
    <>
      <FormSection title="Details">
        <Input
          label="Name"
          value={draft.name}
          onChangeText={vm.setName}
          error={errors.name}
          maxLength={HABIT_NAME_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label="Notes"
          value={draft.notes}
          onChangeText={vm.setNotes}
          error={errors.notes}
          maxLength={HABIT_NOTES_MAX_LENGTH}
          multiline
        />
      </FormSection>
      <AppearanceSection draft={draft} onIcon={vm.setIcon} onColor={vm.setColor} />
      <CategorySection
        categories={vm.categories}
        selectedId={draft.categoryId}
        onSelect={vm.setCategory}
        onCreate={() => setCreatingCategory(true)}
      />
    </>
  );
  const schedule = (
    <>
      <FrequencySection
        draft={draft}
        errors={errors}
        onPreset={vm.setPreset}
        onWeekdays={vm.setWeekdays}
        onGoal={vm.setGoal}
      />
      <HabitReminderSection
        draft={draft}
        error={errors.reminder}
        onToggle={vm.setReminderEnabled}
        onChooseTime={() => void vm.chooseReminderTime()}
      />
    </>
  );

  return (
    <>
      <Stack.Screen options={{ title: vm.isEditing ? 'Edit habit' : 'New habit' }} />
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{basics}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{schedule}</View>
          </View>
        ) : (
          <>
            {basics}
            {schedule}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? 'Save changes' : 'Create habit'}
          fullWidth
          loading={vm.saving}
          onPress={() => void vm.save()}
        />
      </Screen>

      {creatingCategory ? (
        <NameColorSheet
          title="New category"
          initialName=""
          initialColor={ACCENT_COLORS[0]}
          onSave={async (name, color) => {
            const error = await vm.createCategory(name, color);
            if (error === null) {
              setCreatingCategory(false);
            }
            return error;
          }}
          onClose={() => setCreatingCategory(false)}
        />
      ) : null}
    </>
  );
}
