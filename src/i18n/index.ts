import './bootstrap';

export { currentLanguageChoice, deviceLanguageTags, syncLanguage } from './bootstrap';
export { applyDirection } from './direction';
export { planDirection } from './direction-plan';
export { appLocale, isRtl, monthName, weekdayName } from './formatting';
export { i18n } from './instance';
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  LANGUAGE_INFO,
  resolveLanguage,
  type Language,
  type LanguageCode,
} from './languages';
export { msg } from './msg';
export { currentTranslator, translatorFor, type Translator } from './translate';
export { useLanguageChange } from './useLanguageChange';
export { useTranslator } from './useTranslator';
