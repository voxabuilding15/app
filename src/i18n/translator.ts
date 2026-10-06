export type Language = 'system' | 'en' | 'fr';
export type ResolvedLanguage = Exclude<Language, 'system'>;

export const LANGUAGES: readonly { value: Language; native: string }[] = [
  { value: 'system', native: 'System' },
  { value: 'en', native: 'English' },
  { value: 'fr', native: 'Français' },
];

export type Dictionary = Readonly<Record<string, string>>;

export type Vars = Readonly<Record<string, string | number>>;

export interface Translator {
  language: ResolvedLanguage;
  /** BCP 47 tag used to format dates and numbers. */
  locale: string;
  /** Translates an English phrase, filling `{name}` placeholders. Unknown phrases show as written. */
  t: (text: string, vars?: Vars) => string;
  /** Picks the singular or plural phrase for `count`; both may use `{count}`. */
  tn: (count: number, one: string, other: string) => string;
}

/** The language to use for a preference, given the device's locale tag. */
export function resolveLanguage(preference: Language, deviceLocale: string): ResolvedLanguage {
  if (preference !== 'system') {
    return preference;
  }
  return deviceLocale.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function fill(text: string, vars: Vars | undefined): string {
  if (vars === undefined) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function createTranslator(
  language: ResolvedLanguage,
  dictionaries: Readonly<Partial<Record<ResolvedLanguage, Dictionary>>>,
): Translator {
  const dictionary = dictionaries[language];
  const lookup = (text: string) => dictionary?.[text] ?? text;
  return {
    language,
    locale: language,
    t: (text, vars) => fill(lookup(text), vars),
    tn: (count, one, other) => fill(lookup(count === 1 ? one : other), { count }),
  };
}
