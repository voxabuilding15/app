import { colorScheme as nativeWindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorScheme } from './colors';
import { useThemeStore, type ThemePreference } from './store';
import { useTranslator } from '@/i18n';

interface Theme {
  colors: ColorScheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  useEffect(() => {
    nativeWindColorScheme.set(preference);
  }, [preference]);

  const value = useMemo<Theme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      preference,
      setPreference,
    }),
    [isDark, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const { t } = useTranslator();
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(t('useTheme must be used inside ThemeProvider'));
  }
  return theme;
}
