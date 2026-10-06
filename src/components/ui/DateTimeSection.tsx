import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';

interface DateTimeSectionProps {
  title: string;
  /** Text of the date chip, e.g. "Today". Null shows only the "add" chip (see `emptyLabel`). */
  dayLabel: string | null;
  timeLabel: string | null;
  error?: string;
  /** Label of the chip that sets a date when none is set. */
  emptyLabel?: string;
  onPickDay: () => void;
  onPickTime: () => void;
  /** Adds a chip that removes the date again. */
  onClear?: () => void;
  children?: ReactNode;
}

/** Date and time chips that open the system pickers, with an optional "no date" state. */
export function DateTimeSection({
  title,
  dayLabel,
  timeLabel,
  error,
  emptyLabel = 'Add date',
  onPickDay,
  onPickTime,
  onClear,
  children,
}: DateTimeSectionProps) {
  return (
    <FormSection title={title} error={error}>
      <View style={WRAP_ROW}>
        {dayLabel === null || timeLabel === null ? (
          <Chip icon="event" label={emptyLabel} onPress={onPickDay} />
        ) : (
          <>
            <Chip
              icon="event"
              label={dayLabel}
              accessibilityLabel={`Date ${dayLabel}. Change`}
              onPress={onPickDay}
            />
            <Chip
              icon="schedule"
              label={timeLabel}
              accessibilityLabel={`Time ${timeLabel}. Change`}
              onPress={onPickTime}
            />
            {onClear ? (
              <Chip
                icon="close"
                label="Remove"
                accessibilityLabel="Remove date"
                onPress={onClear}
              />
            ) : null}
          </>
        )}
      </View>
      {children}
    </FormSection>
  );
}
