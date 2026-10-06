import { getLocales } from 'expo-localization';

import { setActiveLanguage } from './instance';
import { resolveLanguage, type LanguageCode } from './languages';
import { useLanguageStore } from './store';

/** The phone's languages, most preferred first. */
export function deviceLanguageTags(): string[] {
  try {
    return getLocales().map((locale) => locale.languageTag);
  } catch {
    return [];
  }
}

/** The language the app should show right now: the saved choice, or the phone's language. */
export function currentLanguageChoice(): LanguageCode {
  return resolveLanguage(useLanguageStore.getState().preference, deviceLanguageTags());
}

/** Moves the interface to the language the preference (or the phone) now calls for. */
export function syncLanguage(): void {
  setActiveLanguage(currentLanguageChoice());
}

// On first launch the preference is "System", so the phone's language is detected here; a language
// the user picked later is read back from storage, so it survives restarts.
syncLanguage();
useLanguageStore.subscribe(syncLanguage);
