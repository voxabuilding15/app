import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, radius, useTheme } from '@/theme';

import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.outline;

  return (
    <View className="gap-1">
      <Text variant="labelSmall" tone={error ? 'error' : 'muted'}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.onSurfaceVariant}
        selectionColor={colors.primary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          {
            minHeight: MIN_TOUCH_TARGET + 8,
            paddingHorizontal: 16,
            borderRadius: radius.md,
            borderWidth: focused || error ? 2 : 1,
            borderColor,
            color: colors.onSurface,
            backgroundColor: colors.surface,
            fontSize: 16,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="labelSmall" tone="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
