import { i18n } from './instance';
import { DEFAULT_LANGUAGE, LANGUAGE_INFO, isLanguageCode, type LanguageCode } from './languages';

type Vars = Readonly<Record<string, string | number>>;

export interface Translator {
  language: LanguageCode;
  /** BCP 47 tag used to format dates and numbers. */
  locale: string;
  isRTL: boolean;
  /** Translates an English phrase, filling `{name}` placeholders. Unknown phrases show as written. */
  t: (text: string, vars?: Vars) => string;
  /** Picks the plural form for `count` (languages differ in how many they have); `{count}` is filled. */
  tn: (count: number, one: string, other: string, vars?: Vars) => string;
}

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function buildTranslator(translate: Translate, language: string): Translator {
  const code = isLanguageCode(language) ? language : DEFAULT_LANGUAGE;
  const info = LANGUAGE_INFO[code];
  return {
    language: code,
    locale: info.locale,
    isRTL: info.rtl,
    t: (text, vars) => translate(text, { ...vars }),
    tn: (count, one, other, vars) =>
      translate(one, { ...vars, count, defaultValue_one: one, defaultValue_other: other }),
  };
}

/** A translator fixed to one language, whatever the app is showing (e.g. English for a PDF). */
export function translatorFor(language: LanguageCode): Translator {
  return buildTranslator(i18n.getFixedT(language) as Translate, language);
}

/** The translator for code that is not a React component (notifications, exports, messages). */
export function currentTranslator(): Translator {
  return buildTranslator(i18n.t.bind(i18n) as Translate, i18n.language);
}
