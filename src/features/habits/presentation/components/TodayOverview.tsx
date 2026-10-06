import { View } from 'react-native';

import { Card, ProgressRing, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

interface TodayOverviewProps {
  due: number;
  done: number;
}

export function TodayOverview({ due, done }: TodayOverviewProps) {
  const { t } = useTranslator();
  const headline =
    due === 0
      ? t('Nothing scheduled today')
      : done === due
        ? t('All habits done today')
        : t('{done} of {due} habits done today', { done: done, due: due });

  return (
    <Card
      variant="elevated"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
    >
      <ProgressRing
        progress={due === 0 ? 0 : done / due}
        size={64}
        strokeWidth={8}
        label={
          due === 0
            ? t('No habits scheduled today')
            : t('{done} of {due} habits done today', { done: done, due: due })
        }
      >
        <Text variant="titleMedium">{due === 0 ? '–' : `${done}/${due}`}</Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {headline}
        </Text>
        <Text tone="muted">
          {due === 0 ? t('Enjoy the free day.') : t('Paused and skipped habits are not counted.')}
        </Text>
      </View>
    </Card>
  );
}
