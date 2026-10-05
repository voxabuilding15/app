import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme, type ColorScheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

interface Palette {
  background: string;
  foreground: string;
  border: string;
}

function paletteFor(variant: ButtonVariant, colors: ColorScheme): Palette {
  switch (variant) {
    case 'tonal':
      return {
        background: colors.secondaryContainer,
        foreground: colors.onSecondaryContainer,
        border: 'transparent',
      };
    case 'outlined':
      return { background: 'transparent', foreground: colors.primary, border: colors.outline };
    case 'text':
      return { background: 'transparent', foreground: colors.primary, border: 'transparent' };
    default:
      return { background: colors.primary, foreground: colors.onPrimary, border: 'transparent' };
  }
}

export function Button({
  label,
  onPress,
  variant = 'filled',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const palette = paletteFor(variant, colors);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      haptic="light"
      onPress={onPress}
      style={[{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }, style]}
    >
      <View
        className="flex-row items-center justify-center gap-2 px-6"
        style={{
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: radius.full,
          backgroundColor: palette.background,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.foreground} />
        ) : icon ? (
          <Icon name={icon} size={20} color={palette.foreground} />
        ) : null}
        <Text variant="labelLarge" style={{ color: palette.foreground }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
