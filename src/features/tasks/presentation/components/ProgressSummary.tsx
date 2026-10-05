import { View } from 'react-native';

import { Button, Card, ProgressBar, Text } from '@/components';
import { spacing } from '@/theme';

import type { TaskStats } from '../../domain/entities';

interface ProgressSummaryProps {
  stats: TaskStats;
  onShowOverdue: () => void;
}

export function ProgressSummary({ stats, onShowOverdue }: ProgressSummaryProps) {
  const { dueToday, doneToday, overdue } = stats;
  const headline =
    dueToday === 0
      ? 'Nothing due today'
      : doneToday === dueToday
        ? 'All done for today'
        : `${doneToday} of ${dueToday} due today done`;

  return (
    <Card variant="elevated" style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {headline}
        </Text>
        {dueToday > 0 ? (
          <ProgressBar
            progress={doneToday / dueToday}
            label={`${doneToday} of ${dueToday} tasks due today are done`}
          />
        ) : null}
      </View>
      {overdue > 0 ? (
        <Button
          label={`${overdue} overdue`}
          icon="error-outline"
          variant="tonal"
          onPress={onShowOverdue}
          accessibilityHint="Shows only overdue tasks"
        />
      ) : null}
    </Card>
  );
}
