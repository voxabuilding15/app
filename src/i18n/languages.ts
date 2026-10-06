export type LanguageCode = 'en' | 'fr' | 'ar';
/** What the user picks: a language, or "System" to follow the phone. */
export type Language = 'system' | LanguageCode;

export interface LanguageInfo {
  code: LanguageCode;
  /** The language's own name, always shown in that language so it can be found from any other. */
  native: string;
  rtl: boolean;
  /** Whether the built-in Latin fonts of exported PDF reports can show the language's letters. */
  latin: boolean;
  /**
   * BCP 47 tag for formatting dates and numbers. Arabic keeps Western digits (`nu-latn`), the
   * same ones the rest of the interface shows, and the usual choice in North Africa.
   */
  locale: string;
}

export const LANGUAGE_INFO: Readonly<Record<LanguageCode, LanguageInfo>> = {
  en: { code: 'en', native: 'English', rtl: false, latin: true, locale: 'en' },
  fr: { code: 'fr', native: 'Français', rtl: false, latin: true, locale: 'fr' },
  ar: { code: 'ar', native: 'العربية', rtl: true, latin: false, locale: 'ar-u-nu-latn' },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGE_INFO) as LanguageCode[];
export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && value in LANGUAGE_INFO;
}

/** "fr-CA" -> "fr"; anything unreadable -> null. */
function baseLanguage(tag: string): string | null {
  const base = tag.split(/[-_]/)[0]?.toLowerCase();
  return base === undefined || base === '' ? null : base;
}

/**
 * The language to show: the user's choice, or for "System" the first language in the phone's
 * preference list that the app has, falling back to English.
 */
export function resolveLanguage(preference: Language, deviceTags: readonly string[]): LanguageCode {
  if (preference !== 'system') {
    return preference;
  }
  for (const tag of deviceTags) {
    const base = baseLanguage(tag);
    if (isLanguageCode(base)) {
      return base;
    }
  }
  return DEFAULT_LANGUAGE;
}

/** Reads a stored preference, ignoring anything this version does not know. */
export function parsePreference(value: unknown): Language {
  return value === 'system' || isLanguageCode(value) ? value : 'system';
}
