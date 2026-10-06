import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const locales = join(root, 'src', 'i18n', 'locales');
const LANGUAGES = ['en', 'fr', 'ar'];

describe('translation files', () => {
  it('translate every phrase the code uses, in every language, with every plural form and placeholder', () => {
    const result = spawnSync(process.execPath, ['--no-warnings', 'scripts/i18n.mjs', 'check'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout);
  });

  it('are valid JSON with the same files in every language', () => {
    const names = readdirSync(join(locales, 'en')).sort();
    assert.ok(names.length >= 10);
    for (const language of LANGUAGES) {
      assert.deepEqual(readdirSync(join(locales, language)).sort(), names, language);
      for (const name of names) {
        const data = JSON.parse(readFileSync(join(locales, language, name), 'utf8')) as unknown;
        assert.equal(typeof data, 'object', `${language}/${name}`);
      }
    }
  });

  it('keep each phrase in exactly one file', () => {
    for (const language of LANGUAGES) {
      const seen = new Map<string, string>();
      for (const name of readdirSync(join(locales, language))) {
        const data = JSON.parse(readFileSync(join(locales, language, name), 'utf8')) as Record<
          string,
          string
        >;
        for (const key of Object.keys(data)) {
          assert.equal(
            seen.get(key),
            undefined,
            `${language}: "${key}" is in ${seen.get(key)} and ${name}`,
          );
          seen.set(key, name);
        }
      }
    }
  });

  it('never leave a translation empty', () => {
    for (const language of LANGUAGES) {
      for (const name of readdirSync(join(locales, language))) {
        const data = JSON.parse(readFileSync(join(locales, language, name), 'utf8')) as Record<
          string,
          string
        >;
        for (const [key, value] of Object.entries(data)) {
          assert.notEqual(value.trim(), '', `${language}/${name}: "${key}"`);
        }
      }
    }
  });
});
