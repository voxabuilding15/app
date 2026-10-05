import { View } from 'react-native';

import { Checkbox, IconButton, ProgressRing, Text } from '@/components';
import { spacing } from '@/theme';

import { progressFraction, type HabitSummary } from '../../domain/progress';
import { describeProgress } from '../format';

interface HabitQuickLogProps {
  summary: HabitSummary;
  onAdjust: (delta: number) => void;
  onToggle: () => void;
}

/** Today's controls for a habit: a checkbox for once-a-day goals, otherwise − / ring / +. */
export function HabitQuickLog({ summary, onAdjust, onToggle }: HabitQuickLogProps) {
  const { habit, current, todayCount, skippedToday, scheduledToday } = summary;

  if (habit.paused) {
    return <Text tone="muted">Paused</Text>;
  }
  if (skippedToday) {
    return <Text tone="muted">Skipped today</Text>;
  }
  if (!scheduledToday) {
    return <Text tone="muted">Not scheduled today</Text>;
  }

  if (habit.period === 'daily' && habit.goalCount === 1) {
    return (
      <Checkbox
        checked={todayCount >= 1}
        label={`${habit.name}: ${todayCount >= 1 ? 'mark as not done today' : 'mark as done today'}`}
        onChange={onToggle}
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {todayCount > 0 ? (
        <IconButton
          icon="remove"
          label={`Remove one from ${habit.name}`}
          onPress={() => onAdjust(-1)}
        />
      ) : null}
      <ProgressRing
        progress={progressFraction(summary)}
        size={44}
        strokeWidth={5}
        color={habit.color}
        label={describeProgress(current, habit.period)}
      >
        <Text variant="labelSmall">{String(current.done)}</Text>
      </ProgressRing>
      <IconButton
        icon="add"
        label={`Add one to ${habit.name}`}
        tinted
        onPress={() => onAdjust(1)}
      />
    </View>
  );
}
