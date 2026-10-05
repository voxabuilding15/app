import { View } from 'react-native';

import { Button, Text } from '@/components';
import type { DateKey } from '@/core';
import { spacing } from '@/theme';

import type { CalendarItem } from '../../domain/items';
import { formatDayLong } from '../format';

import { ItemRow } from './ItemRow';

interface DayAgendaPanelProps {
  day: DateKey;
  today: DateKey;
  items: readonly CalendarItem[];
  onPressItem: (item: CalendarItem) => void;
  onAdd: () => void;
}

/** What is planned on the selected day, with a shortcut to add an event. */
export function DayAgendaPanel({ day, today, items, onPressItem, onAdd }: DayAgendaPanelProps) {
  return (
    <View style={{ gap: spacing.sm, padding: spacing.lg }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {day === today ? `Today · ${formatDayLong(day)}` : formatDayLong(day)}
      </Text>
      {items.length === 0 ? (
        <Text tone="muted">Nothing planned for this day.</Text>
      ) : (
        items.map((item) => <ItemRow key={item.key} item={item} onPress={onPressItem} />)
      )}
      <Button label="Add event" icon="add" variant="tonal" onPress={onAdd} />
    </View>
  );
}
