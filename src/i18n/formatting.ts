import { i18n } from './instance';
import { DEFAULT_LANGUAGE, LANGUAGE_INFO, isLanguageCode } from './languages';

function info() {
  const language = i18n.language;
  return LANGUAGE_INFO[isLanguageCode(language) ? language : DEFAULT_LANGUAGE];
}

/** The BCP 47 tag dates, times and numbers are written in, for the language being shown. */
export function appLocale(): string {
  return info().locale;
}

export function isRtl(): boolean {
  return info().rtl;
}

/** Sunday is 0, as in `Date#getDay`. January 7th 2024 was a Sunday. */
export function weekdayName(day: number, width: 'long' | 'short' | 'narrow' = 'short'): string {
  return new Intl.DateTimeFormat(appLocale(), { weekday: width }).format(
    new Date(2024, 0, 7 + day),
  );
}

/** January is 0. */
export function monthName(month: number, width: 'long' | 'short' | 'narrow' = 'long'): string {
  return new Intl.DateTimeFormat(appLocale(), { month: width }).format(new Date(2024, month, 1));
}
