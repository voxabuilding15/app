import { View } from 'react-native';

import { Button, Card, ProgressBar, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { TaskStats } from '../../domain/entities';

interface ProgressSummaryProps {
  stats: TaskStats;
  onShowOverdue: () => void;
}

export function ProgressSummary({ stats, onShowOverdue }: ProgressSummaryProps) {
  const { t } = useTranslator();
  const { dueToday, doneToday, overdue } = stats;
  const headline =
    dueToday === 0
      ? t('Nothing due today')
      : doneToday === dueToday
        ? t('All done for today')
        : t('{doneToday} of {dueToday} due today done', {
            doneToday: doneToday,
            dueToday: dueToday,
          });

  return (
    <Card variant="elevated" style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {headline}
        </Text>
        {dueToday > 0 ? (
          <ProgressBar
            progress={doneToday / dueToday}
            label={t('{doneToday} of {dueToday} tasks due today are done', {
              doneToday: doneToday,
              dueToday: dueToday,
            })}
          />
        ) : null}
      </View>
      {overdue > 0 ? (
        <Button
          label={t('{overdue} overdue', { overdue })}
          icon="error-outline"
          variant="tonal"
          onPress={onShowOverdue}
          accessibilityHint={t('Shows only overdue tasks')}
        />
      ) : null}
    </Card>
  );
}
