import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { PressableScale, Text } from '@/components';
import type { DateKey } from '@/core';
import { radius, spacing, useTheme } from '@/theme';

import { itemsOnDay, type CalendarItem } from '../../domain/items';
import { monthGrid } from '../../domain/views';
import { formatDayLong, weekdayShort } from '../format';
import { useTranslator } from '@/i18n';

const MAX_DOTS = 3;

interface DayCellProps {
  day: DateKey;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: readonly CalendarItem[];
  compact: boolean;
  onSelect: (day: DateKey) => void;
}

function DayCellComponent({
  day,
  inMonth,
  isToday,
  isSelected,
  items,
  compact,
  onSelect,
}: DayCellProps) {
  const { t, tn } = useTranslator();
  const { colors } = useTheme();
  const number = Number(day.slice(8));
  const label = `${formatDayLong(day)}${isToday ? t(', today') : ''}, ${
    items.length === 0 ? t('nothing planned') : tn(items.length, '{count} item', '{count} items')
  }`;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      pressedScale={0.96}
      onPress={() => onSelect(day)}
      style={{ flex: 1 }}
    >
      <View
        style={{
          minHeight: compact ? 52 : 92,
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
          borderRadius: radius.md,
          backgroundColor: isSelected ? colors.secondaryContainer : 'transparent',
          opacity: inMonth ? 1 : 0.45,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isToday ? colors.primary : 'transparent',
          }}
        >
          <Text
            variant="labelLarge"
            style={{ color: isToday ? colors.onPrimary : colors.onSurface }}
          >
            {number}
          </Text>
        </View>
        {compact ? (
          <View style={{ flexDirection: 'row', gap: 3, minHeight: 6 }}>
            {items.slice(0, MAX_DOTS).map((item) => (
              <View
                key={item.key}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: item.color ?? colors.primary,
                }}
              />
            ))}
          </View>
        ) : (
          <View style={{ alignSelf: 'stretch', gap: 2, paddingHorizontal: 2 }}>
            {items.slice(0, 2).map((item) => (
              <View
                key={item.key}
                style={{
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  backgroundColor: item.color ?? colors.primary,
                }}
              >
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={{ color: colors.surface, fontSize: 10, lineHeight: 14 }}
                >
                  {item.title}
                </Text>
              </View>
            ))}
          </View>
        )}
        {items.length > (compact ? MAX_DOTS : 2) ? (
          <Text variant="labelSmall" tone="muted" style={{ fontSize: 10, lineHeight: 12 }}>
            {`+${items.length - (compact ? MAX_DOTS : 2)}`}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const DayCell = memo(DayCellComponent);

interface MonthGridProps {
  anchor: DateKey;
  today: DateKey;
  items: readonly CalendarItem[];
  /** Dots instead of titles, for narrow layouts. */
  compact: boolean;
  onSelectDay: (day: DateKey) => void;
}

/** Month calendar: weeks of day cells showing what is planned on each day. */
export function MonthGrid({ anchor, today, items, compact, onSelectDay }: MonthGridProps) {
  const rows = useMemo(() => monthGrid(anchor), [anchor]);
  const byDay = useMemo(() => {
    const map = new Map<DateKey, CalendarItem[]>();
    for (const row of rows) {
      for (const cell of row) {
        map.set(cell.day, itemsOnDay(items, cell.day));
      }
    }
    return map;
  }, [rows, items]);

  return (
    <View style={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
      <View style={{ flexDirection: 'row' }}>
        {rows[0]!.map((cell) => (
          <View key={cell.day} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="labelSmall" tone="muted">
              {weekdayShort(cell.day)}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((row) => (
        <View key={row[0]!.day} style={{ flexDirection: 'row' }}>
          {row.map((cell) => (
            <DayCell
              key={cell.day}
              day={cell.day}
              inMonth={cell.inMonth}
              isToday={cell.day === today}
              isSelected={cell.day === anchor}
              items={byDay.get(cell.day) ?? []}
              compact={compact}
              onSelect={onSelectDay}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
