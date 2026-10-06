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
import { useTranslator } from '@/i18n';

import { FREQUENCY_PRESETS, presetOf, type FrequencyPreset } from '../../domain/schedule';
import type { HabitDraft, HabitDraftErrors } from '../../domain/validation';
import { MAX_GOAL } from '../../domain/validation';
import { formatReminderTime, goalPerLabel } from '../format';
import { HABIT_ICONS } from '../icons';

import { HabitIconBubble } from './HabitIconBubble';
import { msg } from '@/i18n/msg';
import { translatedLabels } from '@/i18n/labels';

const PRESET_LABEL: Record<FrequencyPreset, string> = translatedLabels({
  daily: msg('Daily'),
  weekly: msg('Weekly'),
  monthly: msg('Monthly'),
  custom: msg('Custom days'),
});

interface AppearanceSectionProps {
  draft: HabitDraft;
  onIcon: (icon: string) => void;
  onColor: (color: string) => void;
}

export function AppearanceSection({ draft, onIcon, onColor }: AppearanceSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Look')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <HabitIconBubble icon={draft.icon} color={draft.color} size={56} />
        <Text tone="muted" style={{ flex: 1 }}>
          {t('Pick an icon and a color to recognize this habit at a glance.')}
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
  const { t } = useTranslator();
  const preset = presetOf(draft);

  return (
    <FormSection title={t('Frequency and goal')} error={errors.weekdays ?? errors.goal}>
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
            {t('Scheduled days')}
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
        <Text style={{ flex: 1 }}>{goalPerLabel(draft.period)}</Text>
        <NumberStepper
          label={goalPerLabel(draft.period)}
          value={draft.goalCount}
          min={1}
          max={MAX_GOAL}
          onChange={onGoal}
        />
      </View>
      <Text variant="labelSmall" tone="muted">
        {draft.period === 'daily'
          ? t('Complete the goal on each scheduled day to keep your streak.')
          : draft.period === 'weekly'
            ? t('Reach the goal within each week to keep your streak.')
            : t('Reach the goal within each month to keep your streak.')}
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
  const { t } = useTranslator();
  return (
    <FormSection title={t('Reminder')} error={error}>
      <SwitchRow
        title={t('Remind me')}
        subtitle={
          draft.period === 'daily' && draft.weekdays !== 0b1111111
            ? t('On the scheduled days')
            : t('Every day')
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
            accessibilityLabel={t('Reminder time {reminderTime}. Change', {
              reminderTime: formatReminderTime(draft.reminderTime),
            })}
            onPress={onChooseTime}
          />
        </View>
      ) : null}
    </FormSection>
  );
}
