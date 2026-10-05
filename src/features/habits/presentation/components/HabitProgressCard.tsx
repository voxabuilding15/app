import { View } from 'react-native';

import { Button, Card, NumberStepper, ProgressRing, Text } from '@/components';
import { spacing } from '@/theme';

import { progressFraction, type HabitSummary } from '../../domain/progress';
import { describeProgress, describeState } from '../format';

interface HabitProgressCardProps {
  summary: HabitSummary;
  onAdjustToday: (delta: number) => void;
  onSkipToday: () => void;
  onTogglePause: () => void;
}

/** Hero card of the detail screen: current-period progress and today's quick controls. */
export function HabitProgressCard({
  summary,
  onAdjustToday,
  onSkipToday,
  onTogglePause,
}: HabitProgressCardProps) {
  const { habit, current, todayCount, skippedToday, scheduledToday } = summary;
  const archived = habit.archivedAt !== null;
  const status = habit.paused ? 'Paused' : describeState(current.state);

  return (
    <Card variant="elevated" style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <ProgressRing
          progress={progressFraction(summary)}
          size={96}
          strokeWidth={10}
          color={habit.color}
          label={describeProgress(current, habit.period)}
        >
          <Text variant="titleLarge">{`${current.done}/${current.goal}`}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {describeProgress(current, habit.period)}
          </Text>
          <Text tone="muted">{status}</Text>
        </View>
      </View>

      {archived ? null : (
        <View style={{ gap: spacing.md }}>
          {habit.paused ? null : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <Text>Logged today</Text>
              <NumberStepper
                label="Completions today"
                value={todayCount}
                max={999}
                onChange={(value) => onAdjustToday(value - todayCount)}
              />
            </View>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {habit.paused ? null : (
              <Button
                label={skippedToday ? 'Unskip today' : 'Skip today'}
                icon={skippedToday ? 'undo' : 'skip-next'}
                variant="tonal"
                onPress={onSkipToday}
                accessibilityHint={
                  scheduledToday
                    ? 'Excuses today so it does not break your streak'
                    : 'Today is not a scheduled day'
                }
              />
            )}
            <Button
              label={habit.paused ? 'Resume habit' : 'Pause habit'}
              icon={habit.paused ? 'play-arrow' : 'pause'}
              variant="outlined"
              onPress={onTogglePause}
              accessibilityHint={
                habit.paused
                  ? 'Resumes tracking and reminders'
                  : 'Stops tracking and reminders without breaking your streak'
              }
            />
          </View>
        </View>
      )}
    </Card>
  );
}
