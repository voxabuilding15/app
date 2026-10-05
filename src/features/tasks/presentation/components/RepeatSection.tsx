import { useState } from 'react';
import { View } from 'react-native';

import { Chip, Input, Text } from '@/components';
import { spacing } from '@/theme';

import type { RepeatRule, RepeatUnit } from '../../domain/entities';
import {
  REPEAT_PRESETS,
  hasWeekday,
  presetOf,
  weekdayBit,
  type RepeatPreset,
} from '../../domain/repeat';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_LABELS, describeRepeat } from '../format';

import { FormSection, WRAP_ROW } from './FormSection';

const PRESET_LABEL: Record<RepeatPreset, string> = {
  none: 'Never',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  custom: 'Custom',
};

const UNITS: readonly { value: RepeatUnit; label: string }[] = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

interface RepeatSectionProps {
  rule: RepeatRule | null;
  error?: string;
  onPreset: (preset: RepeatPreset) => void;
  onChange: (changes: Partial<RepeatRule>) => void;
}

function CustomRepeat({
  rule,
  onChange,
}: {
  rule: RepeatRule;
  onChange: (changes: Partial<RepeatRule>) => void;
}) {
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
          {UNITS.map((unit) => (
            <Chip
              key={unit.value}
              label={unit.label}
              selected={rule.unit === unit.value}
              onPress={() => onChange({ unit: unit.value })}
            />
          ))}
        </View>
      </View>
      {rule.unit === 'week' ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            On these days (leave empty to repeat on the due date’s weekday)
          </Text>
          <View style={WRAP_ROW}>
            {WEEKDAY_DISPLAY_ORDER.map((day) => (
              <Chip
                key={day}
                label={WEEKDAY_LABELS[day] ?? ''}
                selected={hasWeekday(rule.weekdays, day)}
                onPress={() => onChange({ weekdays: rule.weekdays ^ weekdayBit(day) })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function RepeatSection({ rule, error, onPreset, onChange }: RepeatSectionProps) {
  const preset = presetOf(rule);

  return (
    <FormSection title="Repeat" error={error}>
      <View style={WRAP_ROW}>
        {REPEAT_PRESETS.map((option) => (
          <Chip
            key={option}
            label={PRESET_LABEL[option]}
            selected={preset === option}
            onPress={() => onPreset(option)}
          />
        ))}
      </View>
      {rule !== null && preset === 'custom' ? (
        <CustomRepeat rule={rule} onChange={onChange} />
      ) : null}
      {rule !== null ? (
        <Text variant="labelSmall" tone="muted">
          {`${describeRepeat(rule)}. Completing the task creates the next one automatically.`}
        </Text>
      ) : null}
    </FormSection>
  );
}
