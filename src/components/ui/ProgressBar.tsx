import { View } from 'react-native';

import { radius, useTheme } from '@/theme';

export interface ProgressBarProps {
  /** Fraction between 0 and 1. */
  progress: number;
  label: string;
  height?: number;
  /** Fill color; defaults to the theme's primary color. */
  color?: string;
}

export function ProgressBar({ progress, label, height = 8, color }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height,
        borderRadius: radius.full,
        backgroundColor: colors.outlineVariant,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: color ?? colors.primary,
        }}
      />
    </View>
  );
}
