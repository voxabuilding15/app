import { useHaptics } from '@/hooks';
import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const { colors } = useTheme();
  const haptics = useHaptics();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={{
        minHeight: MIN_TOUCH_TARGET - 16,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: radius.md,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.outline,
        backgroundColor: selected ? colors.secondaryContainer : 'transparent',
      }}
    >
      <Text
        variant="labelLarge"
        style={{ color: selected ? colors.onSecondaryContainer : colors.onSurfaceVariant }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
