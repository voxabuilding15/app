import type { ReactNode } from 'react';
import { View } from 'react-native';

import { MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  trailing?: ReactNode;
  onPress?: () => void;
}

export function ListItem({ title, subtitle, icon, trailing, onPress }: ListItemProps) {
  const { colors } = useTheme();

  const content = (
    <View
      style={{
        minHeight: MIN_TOUCH_TARGET + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      {icon ? <Icon name={icon} color={colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge">{title}</Text>
        {subtitle ? (
          <Text variant="bodyMedium" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      pressedScale={0.99}
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}
