import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components';
import { radius, spacing, useTheme } from '@/theme';

import type { CalendarItem } from '../../domain/items';
import { describeHabitStatus, describeItem, formatTime } from '../format';

const HABIT_STATUS_ICON = {
  done: 'check-circle',
  partial: 'timelapse',
  pending: 'radio-button-unchecked',
  missed: 'cancel',
  skipped: 'skip-next',
} as const satisfies Record<string, IconName>;

interface ItemRowProps {
  item: CalendarItem;
  onPress: (item: CalendarItem) => void;
}

/** One calendar item (event, task or habit) as a tappable row. */
export function ItemRow({ item, onPress }: ItemRowProps) {
  const { colors } = useTheme();
  const accent = item.color ?? colors.primary;
  const timeLabel = item.allDay ? 'All day' : formatTime(item.start);
  const done = item.kind === 'task' && item.done;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={describeItem(item)}
      pressedScale={0.99}
      onPress={() => onPress(item)}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: 56,
          paddingRight: spacing.md,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: colors.surfaceContainer,
        }}
      >
        <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: accent }} />
        <Text variant="labelSmall" tone="muted" style={{ width: 64 }}>
          {timeLabel}
        </Text>
        <View style={{ flex: 1, paddingVertical: spacing.sm }}>
          <Text
            variant="bodyLarge"
            numberOfLines={2}
            style={
              done
                ? { textDecorationLine: 'line-through', color: colors.onSurfaceVariant }
                : undefined
            }
          >
            {item.title}
          </Text>
          {item.kind === 'event' && item.location ? (
            <Text variant="labelSmall" tone="muted" numberOfLines={1}>
              {item.location}
            </Text>
          ) : null}
          {item.kind === 'habit' ? (
            <Text variant="labelSmall" tone="muted">
              {`Habit · ${describeHabitStatus(item)}`}
            </Text>
          ) : null}
          {item.kind === 'task' ? (
            <Text variant="labelSmall" tone="muted">
              Task
            </Text>
          ) : null}
        </View>
        {item.kind === 'event' && item.recurring ? <Icon name="repeat" size={18} /> : null}
        {item.kind === 'task' ? (
          <Icon
            name={item.done ? 'check-circle' : 'radio-button-unchecked'}
            size={22}
            color={item.done ? colors.success : colors.onSurfaceVariant}
          />
        ) : null}
        {item.kind === 'habit' ? (
          <Icon name={HABIT_STATUS_ICON[item.status]} size={22} color={accent} />
        ) : null}
      </View>
    </PressableScale>
  );
}
