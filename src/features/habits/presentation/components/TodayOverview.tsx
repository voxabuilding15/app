import { View } from 'react-native';

import { Card, ProgressRing, Text } from '@/components';
import { spacing } from '@/theme';

interface TodayOverviewProps {
  due: number;
  done: number;
}

export function TodayOverview({ due, done }: TodayOverviewProps) {
  const headline =
    due === 0
      ? 'Nothing scheduled today'
      : done === due
        ? 'All habits done today'
        : `${done} of ${due} habits done today`;

  return (
    <Card
      variant="elevated"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
    >
      <ProgressRing
        progress={due === 0 ? 0 : done / due}
        size={64}
        strokeWidth={8}
        label={due === 0 ? 'No habits scheduled today' : `${done} of ${due} habits done today`}
      >
        <Text variant="titleMedium">{due === 0 ? '–' : `${done}/${due}`}</Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {headline}
        </Text>
        <Text tone="muted">
          {due === 0 ? 'Enjoy the free day.' : 'Paused and skipped habits are not counted.'}
        </Text>
      </View>
    </Card>
  );
}
