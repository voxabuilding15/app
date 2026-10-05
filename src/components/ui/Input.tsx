import { forwardRef, useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH_TARGET, radius, spacing, useTheme } from '@/theme';

import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  /** Hides the visible label (it stays available to screen readers) for dense layouts. */
  labelHidden?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, labelHidden = false, multiline, onFocus, onBlur, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.outline;

  return (
    <View style={{ gap: spacing.xs }}>
      {labelHidden ? null : (
        <Text variant="labelSmall" tone={error ? 'error' : 'muted'}>
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.onSurfaceVariant}
        selectionColor={colors.primary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
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
            minHeight: multiline ? 104 : MIN_TOUCH_TARGET + 8,
            paddingHorizontal: spacing.lg,
            paddingVertical: multiline ? spacing.md : 0,
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
