export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainer: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  success: string;
  warning: string;
  info: string;
  scrim: string;
}

export const lightColors: ColorScheme = {
  primary: '#7B2FF7',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EBDDFF',
  onPrimaryContainer: '#25005A',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1E192B',
  background: '#FEF7FF',
  onBackground: '#1D1B20',
  surface: '#FFFFFF',
  onSurface: '#1D1B20',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',
  surfaceContainer: '#F3EDF7',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  success: '#2E7D32',
  warning: '#B26A00',
  info: '#0B6BCB',
  scrim: '#000000',
};

export const darkColors: ColorScheme = {
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  background: '#0B0A0F',
  onBackground: '#E6E0E9',
  surface: '#141218',
  onSurface: '#E6E0E9',
  surfaceVariant: '#49454F',
  onSurfaceVariant: '#CAC4D0',
  surfaceContainer: '#211F26',
  outline: '#938F99',
  outlineVariant: '#49454F',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  success: '#81C784',
  warning: '#FFB74D',
  info: '#64B5F6',
  scrim: '#000000',
};
