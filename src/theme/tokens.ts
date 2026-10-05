export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 16,
  full: 999,
} as const;

export const typography = {
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Android `sw600dp`: smallest screen dimension that counts as a tablet. */
export const TABLET_MIN_DIMENSION = 600;
export const CONTENT_MAX_WIDTH = 720;
export const DRAWER_WIDTH = 288;
export const MIN_TOUCH_TARGET = 48;

/** Palette for user-defined categories and labels; used for dots and swatches, never for text. */
export const ACCENT_COLORS = [
  '#7B2FF7',
  '#2563EB',
  '#0891B2',
  '#16A34A',
  '#CA8A04',
  '#EA580C',
  '#DC2626',
  '#DB2777',
] as const;
