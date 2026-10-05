import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, useTheme, type ColorScheme, type TypographyVariant } from '@/theme';

export type TextTone = 'default' | 'muted' | 'primary' | 'error' | 'success' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
}

function resolveTone(tone: TextTone, colors: ColorScheme): string {
  switch (tone) {
    case 'muted':
      return colors.onSurfaceVariant;
    case 'primary':
      return colors.primary;
    case 'error':
      return colors.error;
    case 'success':
      return colors.success;
    case 'inverse':
      return colors.onPrimary;
    default:
      return colors.onSurface;
  }
}

export function Text({ variant = 'bodyMedium', tone = 'default', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText style={[typography[variant], { color: resolveTone(tone, colors) }, style]} {...rest} />
  );
}
