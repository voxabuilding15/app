import { useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Pressable, View } from 'react-native';

import { Text } from '@/components';
import { radius, useTheme, withAlpha } from '@/theme';

import type { CalendarItem, EventItem } from '../../domain/items';
import {
  SNAP_MINUTES,
  dragToShift,
  isNoShift,
  type TimeShift,
  type TimelineBlock,
} from '../../domain/timeline';
import { describeItem, formatTimeRange } from '../format';

const LONG_PRESS_MS = 250;
const BLOCK_INSET = 2;
const SHOW_TIME_MIN_HEIGHT = 40;

interface BlockMetrics {
  columnWidth: number;
  hourHeight: number;
  /** False in single-day views, where a block can only move up and down. */
  moveAcrossDays: boolean;
}

interface TimelineBlockViewProps {
  block: TimelineBlock;
  metrics: BlockMetrics;
  onPress: (item: CalendarItem) => void;
  /** Resolves once the move has been applied and the calendar refreshed. */
  onMove: (item: EventItem, shift: TimeShift) => Promise<void>;
}

/**
 * A timed item on the timeline. Events can be dragged after a long press: vertical movement
 * changes the time (snapped to 15 minutes), horizontal movement changes the day.
 */
export function TimelineBlockView({ block, metrics, onPress, onMove }: TimelineBlockViewProps) {
  const { colors } = useTheme();
  const { item, startMinutes, endMinutes, column, columns } = block;
  const { columnWidth, hourHeight } = metrics;
  const accent = item.color ?? colors.primary;
  const isEvent = item.kind === 'event';

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Once the item has moved, its new position replaces the drag offset.
  useEffect(() => {
    translateX.set(0);
    translateY.set(0);
  }, [item.start, startMinutes, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }, { translateY: translateY.get() }],
    zIndex: lifted.get() > 0 ? 20 : 1,
    elevation: lifted.get() > 0 ? 6 : 0,
  }));

  const height = Math.max(20, ((endMinutes - startMinutes) / 60) * hourHeight - BLOCK_INSET);
  const laneWidth = columnWidth / columns;

  const commit = async (shift: TimeShift) => {
    if (item.kind !== 'event' || isNoShift(shift)) {
      translateX.set(0);
      translateY.set(0);
      return;
    }
    await onMove(item, shift);
    translateX.set(0);
    translateY.set(0);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(isEvent)
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => lifted.set(1))
    .onUpdate((event) => {
      translateX.set(metrics.moveAcrossDays ? event.translationX : 0);
      translateY.set(event.translationY);
    })
    .onEnd((event) => {
      const shift = dragToShift(
        metrics.moveAcrossDays ? event.translationX : 0,
        event.translationY,
        {
          columnWidth: metrics.moveAcrossDays ? columnWidth : 0,
          hourHeight,
        },
      );
      // Rest on the snapped position while the move is applied.
      translateX.set(shift.days * columnWidth);
      translateY.set((shift.minutes / 60) * hourHeight);
      void commit(shift);
    })
    .onFinalize(() => lifted.set(0))
    .withTestId(`block:${item.key}`);

  const nudge = (shift: TimeShift) => void commit(shift);

  const body = (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={describeItem(item)}
      accessibilityActions={
        isEvent
          ? [
              { name: 'earlier', label: `Move ${SNAP_MINUTES} minutes earlier` },
              { name: 'later', label: `Move ${SNAP_MINUTES} minutes later` },
              { name: 'previousDay', label: 'Move to the previous day' },
              { name: 'nextDay', label: 'Move to the next day' },
            ]
          : undefined
      }
      onAccessibilityAction={({ nativeEvent }) => {
        switch (nativeEvent.actionName) {
          case 'earlier':
            return nudge({ days: 0, minutes: -SNAP_MINUTES });
          case 'later':
            return nudge({ days: 0, minutes: SNAP_MINUTES });
          case 'previousDay':
            return nudge({ days: -1, minutes: 0 });
          default:
            return nudge({ days: 1, minutes: 0 });
        }
      }}
      onPress={() => onPress(item)}
      style={{
        flex: 1,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: radius.md / 2,
        backgroundColor: withAlpha(accent, item.kind === 'task' ? 0.12 : 0.22),
        borderWidth: item.kind === 'task' ? 1 : 0,
        borderStyle: 'dashed',
        borderColor: accent,
      }}
    >
      <View style={{ width: 4, backgroundColor: accent }} />
      <View style={{ flex: 1, paddingHorizontal: 4, paddingVertical: 2 }}>
        <Text
          variant="labelSmall"
          numberOfLines={height >= 44 ? 2 : 1}
          style={{ fontWeight: '700' }}
        >
          {item.title}
        </Text>
        {height >= SHOW_TIME_MIN_HEIGHT ? (
          <Text
            variant="labelSmall"
            tone="muted"
            numberOfLines={1}
            style={{ fontSize: 10, lineHeight: 12 }}
          >
            {formatTimeRange(item)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: (startMinutes / 60) * hourHeight + BLOCK_INSET / 2,
          left: column * laneWidth + BLOCK_INSET,
          width: laneWidth - BLOCK_INSET * 2,
          height,
        },
        animatedStyle,
      ]}
    >
      {isEvent ? <GestureDetector gesture={pan}>{body}</GestureDetector> : body}
    </Animated.View>
  );
}
