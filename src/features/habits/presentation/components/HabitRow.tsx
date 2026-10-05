import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, ProgressBar, SwipeableRow, Text, type SwipeAction } from '@/components';
import { radius, spacing, useTheme } from '@/theme';

import { progressFraction, type HabitSummary } from '../../domain/progress';
import {
  describeFrequency,
  describeGoal,
  describeHabit,
  describeProgress,
  describeStreak,
} from '../format';

import { HabitIconBubble } from './HabitIconBubble';
import { HabitQuickLog } from './HabitQuickLog';

export interface HabitRowProps {
  summary: HabitSummary;
  onPress: (summary: HabitSummary) => void;
  onAdjust: (summary: HabitSummary, delta: number) => void;
  onToggle: (summary: HabitSummary) => void;
  onSkip: (summary: HabitSummary) => void;
  onArchive: (summary: HabitSummary) => void;
  onRestore: (summary: HabitSummary) => void;
  onDelete: (summary: HabitSummary) => void;
}

function HabitRowComponent({
  summary,
  onPress,
  onAdjust,
  onToggle,
  onSkip,
  onArchive,
  onRestore,
  onDelete,
}: HabitRowProps) {
  const { colors } = useTheme();
  const { habit, current, streak } = summary;
  const archived = habit.archivedAt !== null;
  const canLog = !archived && !habit.paused;

  const deleteAction: SwipeAction = {
    label: 'Delete',
    icon: 'delete',
    background: colors.error,
    foreground: colors.surface,
    onPress: () => onDelete(summary),
  };
  const rightActions: SwipeAction[] = archived
    ? [
        {
          label: 'Restore',
          icon: 'unarchive',
          background: colors.primary,
          foreground: colors.onPrimary,
          onPress: () => onRestore(summary),
        },
        deleteAction,
      ]
    : [
        {
          label: 'Archive',
          icon: 'archive',
          background: colors.secondaryContainer,
          foreground: colors.onSecondaryContainer,
          onPress: () => onArchive(summary),
        },
        deleteAction,
      ];
  const leftActions: SwipeAction[] = canLog
    ? [
        {
          label: summary.skippedToday ? 'Unskip' : 'Skip today',
          icon: summary.skippedToday ? 'undo' : 'skip-next',
          background: colors.secondaryContainer,
          foreground: colors.onSecondaryContainer,
          onPress: () => onSkip(summary),
        },
      ]
    : [];

  const accessibilityActions = [
    ...(canLog
      ? [
          { name: 'log', label: 'Add one' },
          { name: 'unlog', label: 'Remove one' },
          { name: 'skip', label: summary.skippedToday ? 'Unskip today' : 'Skip today' },
        ]
      : []),
    archived ? { name: 'restore', label: 'Restore' } : { name: 'archive', label: 'Archive' },
    { name: 'delete', label: 'Delete' },
  ];

  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
      <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={describeHabit(summary)}
          accessibilityActions={accessibilityActions}
          onAccessibilityAction={({ nativeEvent }) => {
            switch (nativeEvent.actionName) {
              case 'log':
                return onAdjust(summary, 1);
              case 'unlog':
                return onAdjust(summary, -1);
              case 'skip':
                return onSkip(summary);
              case 'archive':
                return onArchive(summary);
              case 'restore':
                return onRestore(summary);
              default:
                return onDelete(summary);
            }
          }}
          onPress={() => onPress(summary)}
          android_ripple={{ color: colors.outlineVariant }}
          style={{
            gap: spacing.md,
            padding: spacing.lg,
            backgroundColor: colors.surfaceContainer,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <HabitIconBubble icon={habit.icon} color={habit.color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyLarge" numberOfLines={2}>
                {habit.name}
              </Text>
              <Text variant="labelSmall" tone="muted" numberOfLines={1}>
                {`${describeFrequency(habit)} · ${describeGoal(habit)}`}
              </Text>
              {habit.category ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: habit.category.color,
                    }}
                  />
                  <Text variant="labelSmall" tone="muted">
                    {habit.category.name}
                  </Text>
                </View>
              ) : null}
            </View>
            {streak > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Icon name="local-fire-department" size={18} color={colors.warning} />
                <Text variant="labelLarge" style={{ color: colors.warning }}>
                  {describeStreak(streak, habit.period)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="labelSmall" tone="muted">
                {describeProgress(current, habit.period)}
              </Text>
              <ProgressBar
                height={4}
                color={habit.color}
                progress={progressFraction(summary)}
                label={describeProgress(current, habit.period)}
              />
            </View>
            {archived ? null : (
              <HabitQuickLog
                summary={summary}
                onAdjust={(delta) => onAdjust(summary, delta)}
                onToggle={() => onToggle(summary)}
              />
            )}
          </View>
        </Pressable>
      </SwipeableRow>
    </View>
  );
}

export const HabitRow = memo(HabitRowComponent);
