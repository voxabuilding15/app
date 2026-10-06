import { currentTranslator } from './translate';

/**
 * A table of texts that is read at the moment it is shown, in the language being shown:
 * `LABEL[kind]` gives the translation, so screens can use the table like plain text.
 * Write each text with `msg(...)` so the translation tooling finds it.
 */
export function translatedLabels<T extends Record<string, string>>(texts: T): T {
  const result = {} as T;
  for (const key of Object.keys(texts) as (keyof T)[]) {
    Object.defineProperty(result, key, {
      enumerable: true,
      get: () => currentTranslator().t(texts[key]),
    });
  }
  return result;
}
