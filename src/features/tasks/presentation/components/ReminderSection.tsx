import { View } from 'react-native';

import { Chip, FormSection, SwitchRow, Text, WRAP_ROW } from '@/components';

import type { DueDate } from '../../domain/entities';
import { reminderOffsetsFor } from '../../domain/reminder';
import { describeReminderOffset } from '../format';

interface ReminderSectionProps {
  due: DueDate;
  offsetMinutes: number | null;
  isAlarm: boolean;
  error?: string;
  onOffset: (offset: number | null) => void;
  onAlarm: (isAlarm: boolean) => void;
}

export function ReminderSection({
  due,
  offsetMinutes,
  isAlarm,
  error,
  onOffset,
  onAlarm,
}: ReminderSectionProps) {
  return (
    <FormSection title="Reminder" error={error}>
      <View style={WRAP_ROW}>
        <Chip label="None" selected={offsetMinutes === null} onPress={() => onOffset(null)} />
        {reminderOffsetsFor(due.hasTime).map((offset) => (
          <Chip
            key={offset}
            label={describeReminderOffset(offset, due.hasTime)}
            selected={offsetMinutes === offset}
            onPress={() => onOffset(offset)}
          />
        ))}
      </View>
      {offsetMinutes !== null ? (
        <View>
          <SwitchRow
            title="Ring as an alarm"
            subtitle="Uses the high-priority Alarms channel with a Complete, Snooze and Dismiss action."
            value={isAlarm}
            onChange={onAlarm}
          />
          {isAlarm ? (
            <Text variant="labelSmall" tone="muted">
              Exact delivery needs the system “Alarms & reminders” permission; without it Android
              may deliver a few minutes late.
            </Text>
          ) : null}
        </View>
      ) : null}
    </FormSection>
  );
}
