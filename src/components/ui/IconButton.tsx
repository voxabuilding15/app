import type { StyleProp, ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  tinted?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  label,
  onPress,
  tinted = false,
  disabled,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      haptic="light"
      onPress={onPress}
      style={[
        {
          width: MIN_TOUCH_TARGET,
          height: MIN_TOUCH_TARGET,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tinted ? colors.secondaryContainer : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} color={tinted ? colors.onSecondaryContainer : colors.onSurface} />
    </PressableScale>
  );
}
