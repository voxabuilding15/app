import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { formatMoney } from '@/core';
import { appLocale, isRtl, monthName, weekdayName } from '@/i18n/formatting';
import { i18n, setActiveLanguage } from '@/i18n/instance';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  LANGUAGE_INFO,
  parsePreference,
  resolveLanguage,
} from '@/i18n/languages';
import { planDirection } from '@/i18n/direction-plan';
import { currentTranslator, translatorFor } from '@/i18n/translate';
import { validateSettings, DEFAULT_SETTINGS } from '@/features/pomodoro/domain/settings';

afterEach(() => setActiveLanguage(DEFAULT_LANGUAGE));

describe('choosing the language', () => {
  it('follows the first phone language the app has, and falls back to English', () => {
    assert.equal(resolveLanguage('system', ['fr-CA', 'en-US']), 'fr');
    assert.equal(resolveLanguage('system', ['de-DE', 'ar-MA', 'fr-FR']), 'ar');
    assert.equal(resolveLanguage('system', ['de-DE']), 'en');
    assert.equal(resolveLanguage('system', []), 'en');
    assert.equal(resolveLanguage('system', ['AR_EG']), 'ar');
  });

  it('keeps an explicit choice whatever the phone says', () => {
    assert.equal(resolveLanguage('en', ['fr-FR']), 'en');
    assert.equal(resolveLanguage('ar', ['en-US']), 'ar');
    assert.equal(resolveLanguage('fr', []), 'fr');
  });

  it('ignores stored values it does not know', () => {
    assert.equal(parsePreference('fr'), 'fr');
    assert.equal(parsePreference('system'), 'system');
    assert.equal(parsePreference('de'), 'system');
    assert.equal(parsePreference(undefined), 'system');
    assert.equal(parsePreference(7), 'system');
  });

  it('describes each language, with only Arabic reading right to left', () => {
    assert.deepEqual(LANGUAGE_CODES, ['en', 'fr', 'ar']);
    assert.deepEqual(
      LANGUAGE_CODES.map((code) => LANGUAGE_INFO[code].rtl),
      [false, false, true],
    );
    assert.equal(LANGUAGE_INFO.ar.native, 'العربية');
  });
});

describe('translating', () => {
  it('shows English as written and fills placeholders', () => {
    const { t } = currentTranslator();
    assert.equal(t('Save'), 'Save');
    assert.equal(t('Edit {name}', { name: 'Tea' }), 'Edit Tea');
    assert.equal(t('A phrase nobody translated'), 'A phrase nobody translated');
  });

  it('translates into French and Arabic', () => {
    setActiveLanguage('fr');
    assert.equal(currentTranslator().t('Save'), 'Enregistrer');
    assert.equal(currentTranslator().t('Edit {name}', { name: 'Thé' }), 'Modifier Thé');
    setActiveLanguage('ar');
    assert.equal(currentTranslator().t('Save'), 'حفظ');
    assert.equal(currentTranslator().t('Edit {name}', { name: 'شاي' }), 'تعديل شاي');
  });

  it('picks the plural form each language needs', () => {
    const words = (language: 'en' | 'fr' | 'ar', counts: number[]) => {
      setActiveLanguage(language);
      return counts.map((count) => currentTranslator().tn(count, '{count} note', '{count} notes'));
    };
    assert.deepEqual(words('en', [0, 1, 2, 5]), ['0 notes', '1 note', '2 notes', '5 notes']);
    assert.deepEqual(words('fr', [0, 1, 2, 5]), ['0 note', '1 note', '2 notes', '5 notes']);
    assert.deepEqual(words('ar', [0, 1, 2, 3, 11, 100]), [
      '0 ملاحظة',
      'ملاحظة واحدة',
      'ملاحظتان',
      '3 ملاحظات',
      '11 ملاحظة',
      '100 ملاحظة',
    ]);
  });

  it('falls back to the English plural text when nothing is translated', () => {
    setActiveLanguage('ar');
    const { tn } = currentTranslator();
    assert.equal(tn(1, '{count} thing', '{count} things'), '1 thing');
    assert.equal(tn(4, '{count} thing', '{count} things'), '4 things');
  });

  it('can translate into a fixed language while another is showing', () => {
    setActiveLanguage('ar');
    assert.equal(translatorFor('en').t('Save'), 'Save');
    assert.equal(translatorFor('fr').t('Save'), 'Enregistrer');
    assert.equal(i18n.language, 'ar');
  });

  it('translates the messages the domain produces', () => {
    setActiveLanguage('fr');
    const errors = validateSettings({ ...DEFAULT_SETTINGS, focusMinutes: 0 });
    assert.match(String(errors.focusMinutes), /entier|nombre/i);
  });
});

describe('formatting', () => {
  it('writes dates and numbers for the language, keeping Western digits in Arabic', () => {
    assert.equal(appLocale(), 'en');
    setActiveLanguage('fr');
    assert.equal(appLocale(), 'fr');
    assert.equal(weekdayName(1, 'long'), 'lundi');
    assert.equal(monthName(0, 'long'), 'janvier');
    setActiveLanguage('ar');
    assert.equal(appLocale(), 'ar-u-nu-latn');
    assert.equal(isRtl(), true);
    assert.equal(weekdayName(1, 'long'), 'الاثنين');
    assert.match(formatMoney(123450, 'USD'), /1,?234\.50/);
    assert.doesNotMatch(formatMoney(123450, 'USD'), /[٠-٩]/);
  });

  it('formats money for the language being shown', () => {
    assert.match(formatMoney(123450, 'EUR'), /€1,234\.50/);
    setActiveLanguage('fr');
    assert.match(formatMoney(123450, 'EUR').replace(/\s/g, ' '), /1 234,50 €/);
  });
});

describe('layout direction', () => {
  it('only restarts when the direction really differs, and only once', () => {
    assert.equal(planDirection(false, false, undefined), 'none');
    assert.equal(planDirection(true, true, 'true'), 'none');
    assert.equal(planDirection(false, true, undefined), 'restart');
    assert.equal(planDirection(true, false, undefined), 'restart');
    assert.equal(planDirection(false, true, 'false'), 'restart');
    // A restart for this direction already happened and it still does not match: carry on.
    assert.equal(planDirection(false, true, 'true'), 'blocked');
  });
});
