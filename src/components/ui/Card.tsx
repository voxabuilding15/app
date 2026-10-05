import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

export interface CardProps extends PropsWithChildren {
  variant?: 'filled' | 'elevated';
  style?: StyleProp<ViewStyle>;
}

export function Card({ variant = 'filled', style, children }: CardProps) {
  const { colors, isDark } = useTheme();

  const elevation: ViewStyle =
    variant === 'elevated'
      ? {
          backgroundColor: colors.surface,
          elevation: isDark ? 0 : 2,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.outlineVariant,
        }
      : {};

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          padding: spacing.lg,
          backgroundColor: colors.surfaceContainer,
        },
        elevation,
        style,
      ]}
    >
      {children}
    </View>
  );
}
