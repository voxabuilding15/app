import { fr } from './fr';
import { useLanguageStore } from './store';
import { createTranslator, resolveLanguage, type Translator } from './translator';

/** The translator for the language chosen right now, for code that is not a React component. */
export function currentTranslator(): Translator {
  const language = resolveLanguage(
    useLanguageStore.getState().preference,
    Intl.DateTimeFormat().resolvedOptions().locale,
  );
  return createTranslator(language, { fr });
}
