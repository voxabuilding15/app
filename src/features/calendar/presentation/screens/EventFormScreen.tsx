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
  ReminderOffsetSection,
  RepeatSection,
  Screen,
  Text,
} from '@/components';
import type { DateKey } from '@/core';
import { useHideTabBar } from '@/hooks';
import { ACCENT_COLORS, spacing, useTheme } from '@/theme';

import {
  EVENT_LOCATION_MAX_LENGTH,
  EVENT_NOTES_MAX_LENGTH,
  EVENT_TITLE_MAX_LENGTH,
  eventReminderOffsetsFor,
  type EventDraft,
} from '../../domain/validation';
import type { EventEntry } from '../../domain/entities';
import { EventTimeSection, RepeatEndControls } from '../components/EventFormSections';
import {
  useEventFormViewModel,
  useEventLoader,
  type NewEventDefaults,
} from '../view-models/useEventFormViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

const REPEAT_PRESETS = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as const;
const REPEAT_UNITS = ['day', 'week', 'month', 'year'] as const;

interface EventFormScreenProps {
  /** Null creates a new event. */
  eventId: string | null;
  /** Which occurrence of a recurring event was opened. */
  occurrenceDate: DateKey | null;
  defaults: NewEventDefaults;
}

export function EventFormScreen({ eventId, occurrenceDate, defaults }: EventFormScreenProps) {
  useHideTabBar();
  const { colors } = useTheme();
  const load = useEventLoader(eventId, occurrenceDate, defaults);
  const title = eventId === null ? 'New event' : 'Edit event';

  if (load.phase === 'ready') {
    return (
      <EventFormBody
        eventId={eventId}
        occurrenceDate={occurrenceDate}
        initial={load.initial}
        series={load.series}
      />
    );
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
            accessibilityLabel="Loading event"
          />
        </View>
      ) : (
        <Screen>
          <EmptyState
            icon="error-outline"
            title={load.phase === 'notFound' ? 'Event not found' : "Couldn't load the event"}
            message={
              load.phase === 'notFound'
                ? 'This event may have been deleted.'
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

interface EventFormBodyProps {
  eventId: string | null;
  occurrenceDate: DateKey | null;
  initial: EventDraft;
  series: EventEntry | null;
}

function EventFormBody({ eventId, occurrenceDate, initial, series }: EventFormBodyProps) {
  const { width } = useWindowDimensions();
  const vm = useEventFormViewModel(eventId, occurrenceDate, initial, series);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const wide = width >= WIDE_MIN_WIDTH;
  const { draft, errors } = vm;

  const details = (
    <>
      <FormSection title="Details">
        <Input
          label="Title"
          value={draft.title}
          onChangeText={vm.setTitle}
          error={errors.title}
          maxLength={EVENT_TITLE_MAX_LENGTH}
          autoFocus={!vm.isEditing}
          returnKeyType="next"
        />
        <Input
          label="Location"
          value={draft.location}
          onChangeText={vm.setLocation}
          error={errors.location}
          maxLength={EVENT_LOCATION_MAX_LENGTH}
        />
        <Input
          label="Notes"
          value={draft.notes}
          onChangeText={vm.setNotes}
          error={errors.notes}
          maxLength={EVENT_NOTES_MAX_LENGTH}
          multiline
        />
      </FormSection>
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
      <EventTimeSection
        draft={draft}
        error={errors.time}
        onAllDay={vm.setAllDay}
        onPick={(kind) => void vm.pick(kind)}
      />
      <RepeatSection
        rule={draft.recurrence}
        presets={REPEAT_PRESETS}
        units={REPEAT_UNITS}
        error={errors.repeat}
        onPreset={vm.setRepeatPreset}
        onChange={vm.changeRepeat}
      >
        {draft.recurrence ? (
          <RepeatEndControls
            rule={draft.recurrence}
            repeatEnd={vm.repeatEnd}
            onEnd={vm.setRepeatEnd}
            onChooseUntil={() => void vm.chooseRepeatUntil()}
            onCount={vm.setRepeatCount}
          />
        ) : null}
      </RepeatSection>
      <ReminderOffsetSection
        offsets={eventReminderOffsetsFor(draft.allDay)}
        value={draft.reminderOffsetMinutes}
        timed={!draft.allDay}
        atLabel="At start"
        error={errors.reminder}
        onChange={vm.setReminder}
      />
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: vm.isEditing ? 'Edit event' : 'New event',
          headerRight: vm.isEditing
            ? () => (
                <IconButton
                  icon="delete"
                  label="Delete event"
                  onPress={() => void vm.deleteEvent()}
                />
              )
            : undefined,
        }}
      />
      <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
        {vm.isRecurringEdit ? (
          <Text tone="muted">
            This event repeats. You will choose whether changes apply to this event or all of them.
          </Text>
        ) : null}
        {wide ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, gap: spacing.lg }}>{details}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>{schedule}</View>
          </View>
        ) : (
          <>
            {schedule}
            {details}
          </>
        )}
        {vm.saveError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {vm.saveError}
          </Text>
        ) : null}
        <Button
          label={vm.isEditing ? 'Save changes' : 'Create event'}
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
