import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Language } from './languages';
import { useLanguageStore } from './store';
import { buildTranslator, type Translate, type Translator } from './translate';

/** The translator for the language being shown; screens using it update when the language changes. */
export function useTranslator(): Translator & {
  preference: Language;
  setPreference: (language: Language) => void;
} {
  const { t, i18n: instance } = useTranslation();
  const preference = useLanguageStore((state) => state.preference);
  const setPreference = useLanguageStore((state) => state.setPreference);
  const language = instance.language;
  return useMemo(
    () => ({
      ...buildTranslator(t as Translate, language),
      preference,
      setPreference,
    }),
    [t, language, preference, setPreference],
  );
}
