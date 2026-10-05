export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  background: string;
  surface: string;
  onSurface: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  outline: string;
  outlineVariant: string;
  error: string;
  success: string;
}

export const lightColors: ColorScheme = {
  primary: '#7B2FF7',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EBDDFF',
  onPrimaryContainer: '#25005A',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1E192B',
  background: '#FEF7FF',
  surface: '#FFFFFF',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  surfaceContainer: '#F3EDF7',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  error: '#B3261E',
  success: '#2E7D32',
};

export const darkColors: ColorScheme = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  background: '#0B0A0F',
  surface: '#141218',
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CAC4D0',
  surfaceContainer: '#211F26',
  outline: '#938F99',
  outlineVariant: '#49454F',
  error: '#F2B8B5',
  success: '#81C784',
};
