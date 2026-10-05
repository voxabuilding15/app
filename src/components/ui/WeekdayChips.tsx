import { View } from 'react-native';

import { hasWeekday, weekdayBit } from '@/core';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Monday-first display order; values are JS weekday numbers (Sunday = 0). */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

interface WeekdayChipsProps {
  /** Selected weekdays as a bitmask (Sunday = bit 0). */
  mask: number;
  onChange: (mask: number) => void;
}

export function WeekdayChips({ mask, onChange }: WeekdayChipsProps) {
  return (
    <View style={WRAP_ROW}>
      {WEEKDAY_DISPLAY_ORDER.map((day) => (
        <Chip
          key={day}
          label={WEEKDAY_LABELS[day] ?? ''}
          selected={hasWeekday(mask, day)}
          onPress={() => onChange(mask ^ weekdayBit(day))}
        />
      ))}
    </View>
  );
}
