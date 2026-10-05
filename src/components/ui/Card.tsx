import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';

import { radius, spacing, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

export type CardVariant = 'elevated' | 'filled' | 'outlined';

export interface CardProps extends PropsWithChildren {
  variant?: CardVariant;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  variant = 'filled',
  onPress,
  accessibilityLabel,
  style,
  children,
}: CardProps) {
  const { colors, isDark } = useTheme();

  const containerStyle: ViewStyle = {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: variant === 'outlined' ? colors.surface : colors.surfaceContainer,
    borderWidth: variant === 'outlined' ? 1 : 0,
    borderColor: colors.outlineVariant,
    ...(variant === 'elevated'
      ? {
          backgroundColor: colors.surface,
          elevation: isDark ? 0 : 2,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0 : 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }
      : null),
  };

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[containerStyle, style]}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel} style={[containerStyle, style]}>
      {children}
    </View>
  );
}
