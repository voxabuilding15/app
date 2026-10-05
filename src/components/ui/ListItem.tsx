import { View } from 'react-native';
import type { ReactNode } from 'react';

import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

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
        gap: 16,
        paddingVertical: 8,
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
    return content;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      pressedScale={0.99}
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}
