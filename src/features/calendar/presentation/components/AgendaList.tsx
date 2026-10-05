import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { PressableScale, Text } from '@/components';
import type { DateKey } from '@/core';
import { spacing } from '@/theme';

import type { CalendarItem } from '../../domain/items';
import { formatDayLong, itemDay } from '../format';

import { ItemRow } from './ItemRow';

type Row =
  { type: 'header'; key: string; day: DateKey } | { type: 'item'; key: string; item: CalendarItem };

interface AgendaListProps {
  items: readonly CalendarItem[];
  today: DateKey;
  onPressItem: (item: CalendarItem) => void;
  /** Called when a day heading is pressed, e.g. to open that day. */
  onPressDay?: (day: DateKey) => void;
  emptyComponent: React.ReactElement;
  headerComponent?: React.ReactElement;
}

/** Items grouped under a heading per day, in order. */
export function AgendaList({
  items,
  today,
  onPressItem,
  onPressDay,
  emptyComponent,
  headerComponent,
}: AgendaListProps) {
  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    let current: DateKey | null = null;
    for (const item of items) {
      const day = itemDay(item);
      if (day !== current) {
        current = day;
        result.push({ type: 'header', key: `day:${day}`, day });
      }
      result.push({ type: 'item', key: item.key, item });
    }
    return result;
  }, [items]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={headerComponent}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
      initialNumToRender={14}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item: row }) =>
        row.type === 'header' ? (
          <PressableScale
            accessibilityRole="header"
            accessibilityLabel={formatDayLong(row.day)}
            disabled={!onPressDay}
            onPress={() => onPressDay?.(row.day)}
            pressedScale={0.99}
          >
            <View style={{ paddingTop: spacing.md }}>
              <Text variant="titleMedium">
                {row.day === today ? `Today · ${formatDayLong(row.day)}` : formatDayLong(row.day)}
              </Text>
            </View>
          </PressableScale>
        ) : (
          <ItemRow item={row.item} onPress={onPressItem} />
        )
      }
    />
  );
}
