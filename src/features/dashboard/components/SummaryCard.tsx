import { Card, Text } from '@/components';
import { spacing } from '@/theme';

interface SummaryCardProps {
  title: string;
  message: string;
}

export function SummaryCard({ title, message }: SummaryCardProps) {
  return (
    <Card style={{ gap: spacing.xs }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      <Text tone="muted">{message}</Text>
    </Card>
  );
}
