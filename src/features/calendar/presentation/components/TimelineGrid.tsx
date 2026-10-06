import { useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { PressableScale, Text } from '@/components';
import type { DateKey } from '@/core';
import { spacing, useTheme } from '@/theme';

import type { CalendarItem, EventItem } from '../../domain/items';
import { allDayItemsOn, timedItemsOn } from '../../domain/items';
import { MINUTES_PER_DAY, layoutTimeline, type TimeShift } from '../../domain/timeline';
import { formatDayLong, formatHour, weekdayShort } from '../format';

import { TimelineBlockView } from './TimelineBlockView';
import { useTranslator } from '@/i18n';

const HOUR_HEIGHT = 56;
const GUTTER_WIDTH = 52;
const MIN_COLUMN_WIDTH = 96;
const FIRST_VISIBLE_HOUR = 7;
const HEADER_CHIPS = 3;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface TimelineGridProps {
  days: readonly DateKey[];
  items: readonly CalendarItem[];
  today: DateKey;
  now: number;
  /** Width available to the grid; day columns are never narrower than a readable minimum. */
  width: number;
  onPressItem: (item: CalendarItem) => void;
  onPressDay?: (day: DateKey) => void;
  onMoveEvent: (item: EventItem, shift: TimeShift) => Promise<void>;
}

function DayColumn({
  day,
  items,
  isToday,
  now,
  columnWidth,
  moveAcrossDays,
  onPressItem,
  onMoveEvent,
}: {
  day: DateKey;
  items: readonly CalendarItem[];
  isToday: boolean;
  now: number;
  columnWidth: number;
  moveAcrossDays: boolean;
  onPressItem: (item: CalendarItem) => void;
  onMoveEvent: (item: EventItem, shift: TimeShift) => Promise<void>;
}) {
  const { colors } = useTheme();
  const blocks = useMemo(() => layoutTimeline(timedItemsOn(items, day), day), [items, day]);
  const nowDate = new Date(now);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  return (
    <View
      style={{
        width: columnWidth,
        height: HOUR_HEIGHT * 24,
        borderLeftWidth: 1,
        borderLeftColor: colors.outlineVariant,
      }}
    >
      {blocks.map((block) => (
        <TimelineBlockView
          key={block.item.key}
          block={block}
          metrics={{ columnWidth, hourHeight: HOUR_HEIGHT, moveAcrossDays }}
          onPress={onPressItem}
          onMove={onMoveEvent}
        />
      ))}
      {isToday ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (nowMinutes / MINUTES_PER_DAY) * HOUR_HEIGHT * 24,
            height: 2,
            backgroundColor: colors.error,
            zIndex: 5,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Hour-by-hour timeline for one or more days (a day or a week). The all-day strip sits above it
 * and the grid scrolls sideways when the day columns do not fit.
 */
export function TimelineGrid({
  days,
  items,
  today,
  now,
  width,
  onPressItem,
  onPressDay,
  onMoveEvent,
}: TimelineGridProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const verticalRef = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const columnWidth = Math.max(MIN_COLUMN_WIDTH, (width - GUTTER_WIDTH) / days.length);
  const contentWidth = GUTTER_WIDTH + columnWidth * days.length;
  const moveAcrossDays = days.length > 1;

  return (
    <ScrollView
      horizontal
      scrollEnabled={contentWidth > width + 1}
      showsHorizontalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ width: Math.max(contentWidth, width), flexGrow: 1 }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', paddingLeft: GUTTER_WIDTH }}>
          {days.map((day) => {
            const allDay = allDayItemsOn(items, day);
            const isToday = day === today;
            return (
              <View
                key={day}
                style={{
                  width: columnWidth,
                  gap: 2,
                  padding: spacing.xs,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.outlineVariant,
                }}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDayLong(day)}${isToday ? t(', today') : ''}`}
                  disabled={!onPressDay}
                  onPress={() => onPressDay?.(day)}
                  pressedScale={0.97}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text variant="labelSmall" tone="muted">
                      {weekdayShort(day)}
                    </Text>
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
                        {Number(day.slice(8))}
                      </Text>
                    </View>
                  </View>
                </PressableScale>
                {allDay.slice(0, days.length === 1 ? allDay.length : HEADER_CHIPS).map((item) => (
                  <PressableScale
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={t('All day: {title}', { title: item.title })}
                    pressedScale={0.97}
                    onPress={() => onPressItem(item)}
                  >
                    <View
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
                  </PressableScale>
                ))}
                {days.length > 1 && allDay.length > HEADER_CHIPS ? (
                  <Text variant="labelSmall" tone="muted" style={{ fontSize: 10 }}>
                    {t('+{count} more', { count: allDay.length - HEADER_CHIPS })}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <ScrollView
          ref={verticalRef}
          style={{ flex: 1 }}
          onLayout={() => {
            if (!scrolled.current) {
              scrolled.current = true;
              verticalRef.current?.scrollTo({
                y: FIRST_VISIBLE_HOUR * HOUR_HEIGHT,
                animated: false,
              });
            }
          }}
        >
          <View style={{ flexDirection: 'row', height: HOUR_HEIGHT * 24 }}>
            <View style={{ width: GUTTER_WIDTH }}>
              {HOURS.map((hour) => (
                <View key={hour} style={{ height: HOUR_HEIGHT }}>
                  {hour > 0 ? (
                    <Text
                      variant="labelSmall"
                      tone="muted"
                      style={{
                        fontSize: 10,
                        lineHeight: 12,
                        textAlign: 'right',
                        paddingRight: 6,
                        marginTop: -6,
                      }}
                    >
                      {formatHour(hour)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0 }}>
                {HOURS.map((hour) => (
                  <View
                    key={hour}
                    style={{
                      height: HOUR_HEIGHT,
                      borderTopWidth: 1,
                      borderTopColor: colors.outlineVariant,
                    }}
                  />
                ))}
              </View>
              {days.map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  items={items}
                  isToday={day === today}
                  now={now}
                  columnWidth={columnWidth}
                  moveAcrossDays={moveAcrossDays}
                  onPressItem={onPressItem}
                  onMoveEvent={onMoveEvent}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}
