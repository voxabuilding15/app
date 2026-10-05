import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { useHaptics } from '@/hooks';
import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

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
  const haptics = useHaptics();
  const inactive = disabled || loading;

  const palette = {
    filled: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
    tonal: {
      bg: colors.secondaryContainer,
      fg: colors.onSecondaryContainer,
      border: 'transparent',
    },
    outlined: { bg: 'transparent', fg: colors.primary, border: colors.outline },
    text: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={[fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      <View
        className="flex-row items-center justify-center gap-2 px-6"
        style={{
          minHeight: MIN_TOUCH_TARGET,
          borderRadius: radius.full,
          backgroundColor: palette.bg,
          borderWidth: variant === 'outlined' ? 1 : 0,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : icon ? (
          <Icon name={icon} size={20} color={palette.fg} />
        ) : null}
        <Text variant="labelLarge" style={{ color: palette.fg }}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
