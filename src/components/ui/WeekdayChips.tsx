import { View } from 'react-native';

import { hasWeekday, weekdayBit } from '@/core';
import { weekdayName } from '@/i18n/formatting';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';

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
          label={weekdayName(day)}
          selected={hasWeekday(mask, day)}
          onPress={() => onChange(mask ^ weekdayBit(day))}
        />
      ))}
    </View>
  );
}
