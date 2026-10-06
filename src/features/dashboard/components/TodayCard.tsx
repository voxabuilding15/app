import { View } from 'react-native';

import { Card, Icon, PressableScale, Text, type IconName } from '@/components';
import { spacing, useTheme } from '@/theme';

interface TodayCardProps {
  title: string;
  value: string;
  caption: string;
  icon: IconName;
  onPress: () => void;
}

const MIN_WIDTH = 160;

/** One headline figure for today, which opens the part of the app it comes from. */
export function TodayCard({ title, value, caption, icon, onPress }: TodayCardProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}. ${caption}`}
      pressedScale={0.98}
      onPress={onPress}
      style={{ flexGrow: 1, flexBasis: MIN_WIDTH, minWidth: MIN_WIDTH }}
    >
      <Card style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={icon} size={20} color={colors.primary} />
          <Text variant="labelLarge" tone="muted">
            {title}
          </Text>
        </View>
        <Text variant="headlineSmall">{value}</Text>
        <Text variant="labelSmall" tone="muted">
          {caption}
        </Text>
      </Card>
    </PressableScale>
  );
}
