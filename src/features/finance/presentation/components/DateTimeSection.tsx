import { View } from 'react-native';

import { Chip, FormSection, WRAP_ROW } from '@/components';

import { formatDate, formatTime } from '../format';

interface DateTimeSectionProps {
  /** Epoch ms. */
  at: number;
  /** Used to say "Today" rather than a date. */
  now: number;
  error?: string;
  onPickDay: () => void;
  onPickTime: () => void;
}

/** Date and time of a transaction, each opening the system picker. */
export function DateTimeSection({ at, now, error, onPickDay, onPickTime }: DateTimeSectionProps) {
  const day = formatDate(at, now);
  const time = formatTime(at);
  return (
    <FormSection title="Date and time" error={error}>
      <View style={WRAP_ROW}>
        <Chip
          icon="event"
          label={day}
          accessibilityLabel={`Date ${day}. Change`}
          onPress={onPickDay}
        />
        <Chip
          icon="schedule"
          label={time}
          accessibilityLabel={`Time ${time}. Change`}
          onPress={onPickTime}
        />
      </View>
    </FormSection>
  );
}
