import { View } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Small colored dot shown before the label (categories and labels). */
  dotColor?: string;
  accessibilityLabel?: string;
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  dotColor,
  accessibilityLabel,
}: ChipProps) {
  const { colors } = useTheme();
  const foreground = selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      haptic="selection"
      pressedScale={0.96}
      onPress={onPress}
      // Visual height is 40dp; hitSlop brings the touch target to the 48dp minimum.
      hitSlop={(MIN_TOUCH_TARGET - 40) / 2}
    >
      <View
        style={{
          height: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.outline,
          backgroundColor: selected ? colors.secondaryContainer : 'transparent',
        }}
      >
        {dotColor ? (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor }} />
        ) : null}
        {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
        <Text variant="labelLarge" style={{ color: foreground }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
