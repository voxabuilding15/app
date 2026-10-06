import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { isRtl } from '@/i18n/formatting';
import { typography, useTheme, type ColorScheme, type TypographyVariant } from '@/theme';

type TextTone = 'default' | 'muted' | 'primary' | 'error' | 'success' | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
}

/** Arabic letters carry marks above and below the line, so lines get a little more room. */
const ARABIC_LINE_SPACING = 1.12;

/** Caps system font scaling so large accessibility sizes stay readable without breaking layouts. */
const MAX_FONT_SCALE = 1.6;

function toneColor(tone: TextTone, colors: ColorScheme): string {
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
  const base = typography[variant];
  const spacing = isRtl()
    ? { lineHeight: Math.round(base.lineHeight * ARABIC_LINE_SPACING) }
    : null;
  return (
    <RNText
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[base, spacing, { color: toneColor(tone, colors) }, style]}
      {...rest}
    />
  );
}
