import { View } from 'react-native';

import { ReminderOffsetSection, SwitchRow, Text } from '@/components';

import type { DueDate } from '../../domain/entities';
import { reminderOffsetsFor } from '../../domain/reminder';

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
    <ReminderOffsetSection
      offsets={reminderOffsetsFor(due.hasTime)}
      value={offsetMinutes}
      timed={due.hasTime}
      atLabel="At due time"
      error={error}
      onChange={onOffset}
    >
      <View>
        <SwitchRow
          title="Ring as an alarm"
          subtitle="Uses the high-priority Alarms channel with a Complete, Snooze and Dismiss action."
          value={isAlarm}
          onChange={onAlarm}
        />
        {isAlarm ? (
          <Text variant="labelSmall" tone="muted">
            Exact delivery needs the system “Alarms & reminders” permission; without it Android may
            deliver a few minutes late.
          </Text>
        ) : null}
      </View>
    </ReminderOffsetSection>
  );
}
