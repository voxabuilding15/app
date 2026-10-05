import { View } from 'react-native';

import {
  Chip,
  FormSection,
  IconPicker,
  NumberStepper,
  SwitchRow,
  Text,
  WRAP_ROW,
  WeekdayChips,
  ColorSwatches,
  type IconName,
} from '@/components';
import { spacing } from '@/theme';

import { FREQUENCY_PRESETS, presetOf, type FrequencyPreset } from '../../domain/schedule';
import type { HabitDraft, HabitDraftErrors } from '../../domain/validation';
import { MAX_GOAL } from '../../domain/validation';
import { periodNoun, formatReminderTime } from '../format';
import { HABIT_ICONS } from '../icons';

import { HabitIconBubble } from './HabitIconBubble';

const PRESET_LABEL: Record<FrequencyPreset, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom days',
};

interface AppearanceSectionProps {
  draft: HabitDraft;
  onIcon: (icon: string) => void;
  onColor: (color: string) => void;
}

export function AppearanceSection({ draft, onIcon, onColor }: AppearanceSectionProps) {
  return (
    <FormSection title="Look">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <HabitIconBubble icon={draft.icon} color={draft.color} size={56} />
        <Text tone="muted" style={{ flex: 1 }}>
          Pick an icon and a color to recognize this habit at a glance.
        </Text>
      </View>
      <IconPicker
        icons={HABIT_ICONS}
        value={draft.icon as IconName}
        onChange={onIcon}
        accent={draft.color}
      />
      <ColorSwatches value={draft.color} onChange={onColor} />
    </FormSection>
  );
}

interface FrequencySectionProps {
  draft: HabitDraft;
  errors: HabitDraftErrors;
  onPreset: (preset: FrequencyPreset) => void;
  onWeekdays: (mask: number) => void;
  onGoal: (goal: number) => void;
}

export function FrequencySection({
  draft,
  errors,
  onPreset,
  onWeekdays,
  onGoal,
}: FrequencySectionProps) {
  const preset = presetOf(draft);

  return (
    <FormSection title="Frequency and goal" error={errors.weekdays ?? errors.goal}>
      <View style={WRAP_ROW}>
        {FREQUENCY_PRESETS.map((option) => (
          <Chip
            key={option}
            label={PRESET_LABEL[option]}
            selected={preset === option}
            onPress={() => onPreset(option)}
          />
        ))}
      </View>
      {preset === 'custom' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            Scheduled days
          </Text>
          <WeekdayChips mask={draft.weekdays} onChange={onWeekdays} />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text style={{ flex: 1 }}>{`Goal per ${periodNoun(draft.period)}`}</Text>
        <NumberStepper
          label={`Goal per ${periodNoun(draft.period)}`}
          value={draft.goalCount}
          min={1}
          max={MAX_GOAL}
          onChange={onGoal}
        />
      </View>
      <Text variant="labelSmall" tone="muted">
        {draft.period === 'daily'
          ? 'Complete the goal on each scheduled day to keep your streak.'
          : `Reach the goal within each ${periodNoun(draft.period)} to keep your streak.`}
      </Text>
    </FormSection>
  );
}

interface ReminderSectionProps {
  draft: HabitDraft;
  error?: string;
  onToggle: (enabled: boolean) => void;
  onChooseTime: () => void;
}

export function HabitReminderSection({
  draft,
  error,
  onToggle,
  onChooseTime,
}: ReminderSectionProps) {
  return (
    <FormSection title="Reminder" error={error}>
      <SwitchRow
        title="Remind me"
        subtitle={
          draft.period === 'daily' && draft.weekdays !== 0b1111111
            ? 'On the scheduled days'
            : 'Every day'
        }
        value={draft.reminderTime !== null}
        onChange={onToggle}
      />
      {draft.reminderTime !== null ? (
        <View style={WRAP_ROW}>
          <Chip
            icon="schedule"
            label={formatReminderTime(draft.reminderTime)}
            selected
            accessibilityLabel={`Reminder time ${formatReminderTime(draft.reminderTime)}. Change`}
            onPress={onChooseTime}
          />
        </View>
      ) : null}
    </FormSection>
  );
}
