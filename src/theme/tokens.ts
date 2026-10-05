export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 999,
} as const;

export const typography = {
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '600' },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

export const TABLET_BREAKPOINT = 768;
export const MIN_TOUCH_TARGET = 48;
