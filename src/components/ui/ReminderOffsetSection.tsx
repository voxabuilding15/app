import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';

const DAY_MINUTES = 24 * 60;

/** "5 min before", "1 hour before", "1 day before, 9:00" ... for a reminder offset. */
function describeLeadTime(offsetMinutes: number, timed: boolean, atLabel: string): string {
  if (!timed) {
    if (offsetMinutes === 0) {
      return 'On the day, 9:00';
    }
    return offsetMinutes === DAY_MINUTES
      ? '1 day before, 9:00'
      : `${offsetMinutes / DAY_MINUTES} days before, 9:00`;
  }
  if (offsetMinutes === 0) {
    return atLabel;
  }
  if (offsetMinutes === DAY_MINUTES) {
    return '1 day before';
  }
  return offsetMinutes >= 60 ? `${offsetMinutes / 60} hour before` : `${offsetMinutes} min before`;
}

interface ReminderOffsetSectionProps {
  /** Offsets (minutes before the start) to offer. */
  offsets: readonly number[];
  value: number | null;
  /** False for all-day items, which are reminded at 9:00. */
  timed: boolean;
  /** Label for a zero offset on timed items, e.g. "At start". */
  atLabel: string;
  error?: string;
  onChange: (offset: number | null) => void;
  /** Extra controls shown once a reminder is chosen. */
  children?: ReactNode;
}

/** Form section for choosing how long before something starts to be reminded. */
export function ReminderOffsetSection({
  offsets,
  value,
  timed,
  atLabel,
  error,
  onChange,
  children,
}: ReminderOffsetSectionProps) {
  return (
    <FormSection title="Reminder" error={error}>
      <View style={WRAP_ROW}>
        <Chip label="None" selected={value === null} onPress={() => onChange(null)} />
        {offsets.map((offset) => (
          <Chip
            key={offset}
            label={describeLeadTime(offset, timed, atLabel)}
            selected={value === offset}
            onPress={() => onChange(offset)}
          />
        ))}
      </View>
      {value !== null ? children : null}
    </FormSection>
  );
}
