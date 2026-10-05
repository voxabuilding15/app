import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import {
  hasWeekday,
  recurrencePresetOf,
  type RecurrencePreset,
  type RecurrenceRule,
  type RecurrenceUnit,
} from '@/core';
import { spacing } from '@/theme';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';
import { Input } from './Input';
import { Text } from './Text';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABELS, WeekdayChips } from './WeekdayChips';

const PRESET_LABEL: Record<RecurrencePreset, string> = {
  none: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

const UNIT_LABEL: Record<RecurrenceUnit, string> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
  year: 'Years',
};

/** Plain-language description such as "Daily", "Every 2 weeks on Mon, Wed" or "Yearly". */
export function describeRecurrence(rule: RecurrenceRule): string {
  const { unit, interval, weekdays } = rule;
  if (unit === 'week' && weekdays !== 0) {
    const days = WEEKDAY_DISPLAY_ORDER.filter((day) => hasWeekday(weekdays, day))
      .map((day) => WEEKDAY_LABELS[day])
      .join(', ');
    return interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
  }
  if (interval === 1) {
    return { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[unit];
  }
  return `Every ${interval} ${unit}s`;
}

interface CustomRecurrenceProps {
  rule: RecurrenceRule;
  units: readonly RecurrenceUnit[];
  onChange: (changes: Partial<RecurrenceRule>) => void;
}

function CustomRecurrence({ rule, units, onChange }: CustomRecurrenceProps) {
  const [text, setText] = useState(String(rule.interval));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
        <View style={{ width: 96 }}>
          <Input
            label="Every"
            value={text}
            keyboardType="number-pad"
            maxLength={3}
            onChangeText={(value) => {
              const digits = value.replace(/\D/g, '');
              setText(digits);
              if (digits !== '' && Number(digits) > 0) {
                onChange({ interval: Number(digits) });
              }
            }}
            onBlur={() => setText(String(rule.interval))}
          />
        </View>
        <View style={[WRAP_ROW, { flex: 1 }]}>
          {units.map((unit) => (
            <Chip
              key={unit}
              label={UNIT_LABEL[unit]}
              selected={rule.unit === unit}
              onPress={() => onChange({ unit })}
            />
          ))}
        </View>
      </View>
      {rule.unit === 'week' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            On these days (leave empty to repeat on the start date’s weekday)
          </Text>
          <WeekdayChips mask={rule.weekdays} onChange={(weekdays) => onChange({ weekdays })} />
        </View>
      ) : null}
    </View>
  );
}

interface RepeatSectionProps {
  rule: RecurrenceRule | null;
  /** Which presets to offer, in order. */
  presets: readonly RecurrencePreset[];
  /** Which units a custom rule may use. */
  units: readonly RecurrenceUnit[];
  error?: string;
  onPreset: (preset: RecurrencePreset) => void;
  onChange: (changes: Partial<RecurrenceRule>) => void;
  /** Sentence shown under the rule summary, e.g. what happens on completion. */
  hint?: string;
  /** Extra controls shown when a rule is set, e.g. an end condition. */
  children?: ReactNode;
}

/** Repeat picker shared by every feature with recurring items. */
export function RepeatSection({
  rule,
  presets,
  units,
  error,
  onPreset,
  onChange,
  hint,
  children,
}: RepeatSectionProps) {
  const preset = recurrencePresetOf(rule);

  return (
    <FormSection title="Repeat" error={error}>
      <View style={WRAP_ROW}>
        {presets.map((option) => (
          <Chip
            key={option}
            label={PRESET_LABEL[option]}
            selected={preset === option}
            onPress={() => onPreset(option)}
          />
        ))}
      </View>
      {rule !== null && preset === 'custom' ? (
        <CustomRecurrence rule={rule} units={units} onChange={onChange} />
      ) : null}
      {rule !== null ? (
        <Text variant="labelSmall" tone="muted">
          {hint ? `${describeRecurrence(rule)}. ${hint}` : describeRecurrence(rule)}
        </Text>
      ) : null}
      {rule !== null ? children : null}
    </FormSection>
  );
}
