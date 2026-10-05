import { View } from 'react-native';

import { radius, useTheme } from '@/theme';

export interface ProgressBarProps {
  progress: number;
  label: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{
        height: 8,
        borderRadius: radius.full,
        backgroundColor: colors.surfaceVariant,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: colors.primary,
        }}
      />
    </View>
  );
}
