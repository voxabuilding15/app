import { createInstance, type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LANGUAGE, type LanguageCode } from './languages';
import { NAMESPACES } from './namespaces';
import { resources } from './resources';

/**
 * Phrases are keyed by their English text (`t('Save')`), so a missing translation shows readable
 * English. Placeholders use single braces (`{count}`). This module has no native dependencies, so
 * it also runs under Node (tests, exports).
 */
export function createI18n(language: LanguageCode): I18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: [...NAMESPACES],
    defaultNS: 'common',
    fallbackNS: [...NAMESPACES],
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    initAsync: false,
    interpolation: { prefix: '{', suffix: '}', escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

export const i18n = createI18n(DEFAULT_LANGUAGE);

/** Switches the words (and the way dates and numbers are written) to `language`. */
export function setActiveLanguage(language: LanguageCode): void {
  if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }
}
