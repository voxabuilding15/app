import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ALL_ACHIEVEMENTS } from '@/features/achievements/domain/catalog';
import { CHALLENGE_TEMPLATES } from '@/features/achievements/domain/challenges';
import { levelTitle } from '@/features/achievements/domain/levels';
import { HOME_ITEM, DRAWER_ITEMS, TAB_ITEMS } from '@/navigation/routes';
import { fr } from '@/i18n/fr';
import { createTranslator, resolveLanguage } from '@/i18n/translator';

/** The folders whose text is translated; earlier features are still English only. */
const TRANSLATED = [
  'src/features/statistics',
  'src/features/achievements',
  'src/features/backup',
  'src/features/settings',
  'src/navigation',
  'src/features/notes/presentation/screens/LockSettingsScreen.tsx',
  'src/components/ui/LockGate.tsx',
  'src/components/ui/PinSheet.tsx',
  'src/components/ui/LockSettingsPanel.tsx',
  'src/hooks/useLockController.ts',
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return files(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const STRING = String.raw`(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|\`((?:\\.|[^\`\\$])*)\`)`;
const T_CALL = new RegExp(String.raw`(?<![\w.])(?:words\.)?t\(\s*${STRING}`, 'g');
const TN_CALL = new RegExp(String.raw`(?<![\w.])tn\(\s*[^,()]+,\s*${STRING}\s*,\s*${STRING}`, 'g');

const unescape = (text: string) => text.replace(/\\(['"`\\])/g, '$1');

function usedPhrases(): Map<string, string> {
  const found = new Map<string, string>();
  for (const folder of TRANSLATED) {
    const dir = join(process.cwd(), folder);
    if (!existsSync(dir)) {
      continue;
    }
    for (const file of statSync(dir).isDirectory() ? files(dir) : [dir]) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(T_CALL)) {
        found.set(unescape(match[1] ?? match[2] ?? match[3] ?? ''), file);
      }
      for (const match of source.matchAll(TN_CALL)) {
        found.set(unescape(match[1] ?? match[2] ?? match[3] ?? ''), file);
        found.set(unescape(match[4] ?? match[5] ?? match[6] ?? ''), file);
      }
    }
  }
  // Texts that live in data rather than next to a call to `t`.
  for (const def of ALL_ACHIEVEMENTS) {
    found.set(def.title, 'achievement catalog');
    found.set(def.description, 'achievement catalog');
  }
  for (const template of CHALLENGE_TEMPLATES) {
    found.set(template.title, 'challenge templates');
  }
  for (let level = 1; level <= 99; level += 1) {
    found.set(levelTitle(level), 'level titles');
  }
  for (const item of [HOME_ITEM, ...TAB_ITEMS, ...DRAWER_ITEMS]) {
    found.set(item.title, 'navigation routes');
  }
  // Messages the lock use cases return, for the notes and for the app itself.
  for (const subject of ['notes', 'app']) {
    found.set(`Unlock your ${subject} first.`, 'lock messages');
  }
  for (const message of [
    'Something went wrong.',
    'Use digits only',
    'Use 4 to 8 digits',
    'Authentication was cancelled.',
    'Set up a fingerprint, face or screen lock in your phone settings first, or use a PIN.',
  ]) {
    found.set(message, 'lock messages');
  }
  found.set('Open the app to see details', 'notification privacy');
  found.set('Weekly challenge completed', 'unlock text');
  found.set('Monthly challenge completed', 'unlock text');
  return found;
}

describe('translations', () => {
  it('finds the phrases in the translated screens', () => {
    assert.ok(usedPhrases().size > 20, `only ${usedPhrases().size} phrases found`);
  });

  it('has a French text for every phrase the translated screens use', () => {
    const missing = [...usedPhrases()].filter(([phrase]) => fr[phrase] === undefined);
    assert.deepEqual(
      missing.map(([phrase, file]) => `${phrase}  (${file.replace(process.cwd(), '')})`),
      [],
    );
  });

  it('keeps no French text that nothing uses any more', () => {
    const used = usedPhrases();
    assert.deepEqual(
      Object.keys(fr).filter((phrase) => !used.has(phrase)),
      [],
    );
  });

  it('keeps every placeholder in the French text', () => {
    for (const [phrase, text] of Object.entries(fr)) {
      const placeholders = (value: string) =>
        [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(placeholders(text), placeholders(phrase), phrase);
    }
  });
});

describe('translator', () => {
  const english = createTranslator('en', { fr });
  const french = createTranslator('fr', {
    fr: {
      Hello: 'Bonjour',
      '{count} item': '{count} élément',
      '{count} items': '{count} éléments',
      'Hi {name}': 'Salut {name}',
    },
  });

  it('shows English phrases as written and fills placeholders', () => {
    assert.equal(english.t('Hi {name}', { name: 'Sam' }), 'Hi Sam');
    assert.equal(english.t('Unknown'), 'Unknown');
    assert.equal(english.tn(1, '{count} item', '{count} items'), '1 item');
    assert.equal(english.tn(3, '{count} item', '{count} items'), '3 items');
  });

  it('translates, falls back to English for what is missing, and keeps unknown placeholders', () => {
    assert.equal(french.t('Hello'), 'Bonjour');
    assert.equal(french.t('Hi {name}', { name: 'Sam' }), 'Salut Sam');
    assert.equal(french.t('Not translated'), 'Not translated');
    assert.equal(french.t('Hi {name}'), 'Salut {name}');
    assert.equal(french.tn(0, '{count} item', '{count} items'), '0 éléments');
    assert.equal(french.tn(1, '{count} item', '{count} items'), '1 élément');
  });

  it('follows the device language unless one is chosen', () => {
    assert.equal(resolveLanguage('system', 'fr-CA'), 'fr');
    assert.equal(resolveLanguage('system', 'en-US'), 'en');
    assert.equal(resolveLanguage('system', 'de-DE'), 'en');
    assert.equal(resolveLanguage('en', 'fr-FR'), 'en');
    assert.equal(resolveLanguage('fr', 'en-US'), 'fr');
  });
});
