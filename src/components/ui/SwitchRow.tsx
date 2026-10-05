import { Switch, View } from 'react-native';

import { MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';

import { Text } from './Text';

export interface SwitchRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SwitchRow({ title, subtitle, value, onChange, disabled }: SwitchRowProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        minHeight: MIN_TOUCH_TARGET + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge">{title}</Text>
        {subtitle ? (
          <Text variant="bodyMedium" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.outlineVariant, true: colors.primary }}
        thumbColor={value ? colors.onPrimary : colors.outline}
      />
    </View>
  );
}
