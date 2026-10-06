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
import { useTranslator } from '@/i18n';
import { weekdayName } from '@/i18n/formatting';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';
import { Input } from './Input';
import { Text } from './Text';
import { WEEKDAY_DISPLAY_ORDER, WeekdayChips } from './WeekdayChips';
import { translatedLabels } from '@/i18n/labels';

const PRESET_LABEL: Record<RecurrencePreset, string> = translatedLabels({
  none: msg('Never'),
  daily: msg('Daily'),
  weekly: msg('Weekly'),
  monthly: msg('Monthly'),
  yearly: msg('Yearly'),
  custom: msg('Custom'),
});

const UNIT_LABEL: Record<RecurrenceUnit, string> = translatedLabels({
  day: msg('Days'),
  week: msg('Weeks'),
  month: msg('Months'),
  year: msg('Years'),
});

/** Plain-language description such as "Daily", "Every 2 weeks on Mon, Wed" or "Yearly". */
export function describeRecurrence(rule: RecurrenceRule): string {
  const { t, tn } = currentTranslator();
  const { unit, interval, weekdays } = rule;
  if (unit === 'week' && weekdays !== 0) {
    const days = WEEKDAY_DISPLAY_ORDER.filter((day) => hasWeekday(weekdays, day))
      .map((day) => weekdayName(day))
      .join(t(', '));
    return interval === 1
      ? t('Weekly on {days}', { days })
      : tn(interval, 'Every {count} week on {days}', 'Every {count} weeks on {days}', { days });
  }
  if (interval === 1) {
    return t(
      { day: msg('Daily'), week: msg('Weekly'), month: msg('Monthly'), year: msg('Yearly') }[unit],
    );
  }
  switch (unit) {
    case 'day':
      return tn(interval, 'Every {count} day', 'Every {count} days');
    case 'week':
      return tn(interval, 'Every {count} week', 'Every {count} weeks');
    case 'month':
      return tn(interval, 'Every {count} month', 'Every {count} months');
    default:
      return tn(interval, 'Every {count} year', 'Every {count} years');
  }
}

interface CustomRecurrenceProps {
  rule: RecurrenceRule;
  units: readonly RecurrenceUnit[];
  onChange: (changes: Partial<RecurrenceRule>) => void;
}

function CustomRecurrence({ rule, units, onChange }: CustomRecurrenceProps) {
  const { t } = useTranslator();
  const [text, setText] = useState(String(rule.interval));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
        <View style={{ width: 96 }}>
          <Input
            label={t('Every')}
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
              label={t(UNIT_LABEL[unit])}
              selected={rule.unit === unit}
              onPress={() => onChange({ unit })}
            />
          ))}
        </View>
      </View>
      {rule.unit === 'week' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            {t('On these days (leave empty to repeat on the start date’s weekday)')}
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
  const { t } = useTranslator();
  const preset = recurrencePresetOf(rule);

  return (
    <FormSection title={t('Repeat')} error={error}>
      <View style={WRAP_ROW}>
        {presets.map((option) => (
          <Chip
            key={option}
            label={t(PRESET_LABEL[option])}
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
