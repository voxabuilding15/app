import { useMemo } from 'react';

import { fr } from './fr';
import { useLanguageStore } from './store';
import { createTranslator, resolveLanguage, type Language, type Translator } from './translator';

const DICTIONARIES = { fr } as const;

function deviceLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

/** The translator for the chosen language, and the setting itself. */
export function useTranslator(): Translator & {
  preference: Language;
  setPreference: (language: Language) => void;
} {
  const preference = useLanguageStore((state) => state.preference);
  const setPreference = useLanguageStore((state) => state.setPreference);
  return useMemo(
    () => ({
      ...createTranslator(resolveLanguage(preference, deviceLocale()), DICTIONARIES),
      preference,
      setPreference,
    }),
    [preference, setPreference],
  );
}
