// Translation tooling. Phrases are keyed by their English text in the code (`t('Save')`), and each
// language has one JSON file per area in src/i18n/locales/<language>/<area>.json.
//
//   node scripts/i18n.mjs extract         refresh the English files from the code
//   node scripts/i18n.mjs check           fail if a language lacks a phrase, a plural form or a placeholder
//   node scripts/i18n.mjs todo <lang>     print what is still untranslated, as JSON
//   node scripts/i18n.mjs merge <lang> <file.json>   add translations from a JSON file
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const localesDir = join(root, 'src', 'i18n', 'locales');
const LANGUAGES = ['en', 'fr', 'ar'];
const FEATURES = [
  'dashboard',
  'tasks',
  'habits',
  'calendar',
  'finance',
  'notes',
  'pomodoro',
  'statistics',
  'achievements',
  'backup',
  'settings',
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function namespaceOf(file) {
  const path = relative(join(root, 'src'), file).split('\\').join('/');
  const feature = /^features\/([^/]+)\//.exec(path)?.[1];
  if (feature !== undefined && FEATURES.includes(feature)) {
    return feature;
  }
  if (path.startsWith('navigation/')) {
    return 'navigation';
  }
  if (path.startsWith('services/notifications/')) {
    return 'notifications';
  }
  return 'common';
}

function literal(node) {
  if (node === undefined) {
    return null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

const calleeName = (expression) =>
  ts.isIdentifier(expression)
    ? expression.text
    : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : null;

/** Every phrase the code asks for: key -> { namespaces, other } (other = plural text). */
export function usedPhrases() {
  const found = new Map();
  const add = (key, file, other) => {
    const entry = found.get(key) ?? { namespaces: new Set(), other: undefined };
    entry.namespaces.add(namespaceOf(file));
    if (other !== undefined) {
      entry.other = other;
    }
    found.set(key, entry);
  };
  for (const file of sourceFiles(join(root, 'src'))) {
    if (file.includes(`${join('src', 'i18n')}`)) {
      continue;
    }
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node.expression);
        if (name === 't' || name === 'msg') {
          const key = literal(node.arguments[0]);
          if (key !== null) {
            add(key, file);
          }
        } else if (name === 'tn') {
          const one = literal(node.arguments[1]);
          const other = literal(node.arguments[2]);
          if (one !== null && other !== null) {
            add(one, file, other);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

function categories(language) {
  return new Intl.PluralRules(language).resolvedOptions().pluralCategories;
}

const placeholders = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

function readNamespace(language, namespace) {
  const path = join(localesDir, language, `${namespace}.json`);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}

function writeNamespace(language, namespace, data) {
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : 1)),
  );
  writeFileSync(join(localesDir, language, `${namespace}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
}

function allNamespaces() {
  return readdirSync(join(localesDir, 'en')).map((name) => name.replace(/\.json$/, ''));
}

/** The namespace a phrase belongs to: its area, or `common` when several areas use it. */
function home(entry) {
  return entry.namespaces.size === 1 ? [...entry.namespaces][0] : 'common';
}

function englishData(used) {
  const byNamespace = Object.fromEntries(allNamespaces().map((ns) => [ns, {}]));
  for (const [key, entry] of used) {
    const bucket = byNamespace[home(entry)];
    if (entry.other === undefined) {
      bucket[key] = key;
    } else {
      bucket[`${key}_one`] = key;
      bucket[`${key}_other`] = entry.other;
    }
  }
  return byNamespace;
}

/** Keys of a language, merged over all namespaces. */
function merged(language) {
  const all = {};
  for (const ns of allNamespaces()) {
    Object.assign(all, readNamespace(language, ns));
  }
  return all;
}

/** Problems found by comparing every language with what the code uses. */
export function problems() {
  const used = usedPhrases();
  const english = englishData(used);
  const expected = Object.assign({}, ...Object.values(english));
  const issues = [];
  for (const language of LANGUAGES) {
    const have = merged(language);
    const places = Object.fromEntries(
      allNamespaces().flatMap((ns) => Object.keys(readNamespace(language, ns)).map((key) => [key, ns])),
    );
    for (const [key, entry] of used) {
      const wanted = home(entry);
      const forms = entry.other === undefined ? [key] : categories(language).map((c) => `${key}_${c}`);
      for (const form of forms) {
        const value = have[form];
        if (typeof value !== 'string' || value.trim() === '') {
          issues.push(`${language}: missing "${form}"`);
          continue;
        }
        if (places[form] !== wanted) {
          issues.push(`${language}: "${form}" is in ${places[form]}.json, expected ${wanted}.json`);
        }
        const reference = expected[form] ?? expected[`${key}_other`] ?? key;
        if (placeholders(value).join() !== placeholders(reference).join()) {
          issues.push(`${language}: "${form}" has different placeholders than the English`);
        }
      }
    }
    const valid = new Set(
      [...used].flatMap(([key, entry]) =>
        entry.other === undefined ? [key] : categories(language).map((c) => `${key}_${c}`),
      ),
    );
    for (const key of Object.keys(have)) {
      if (!valid.has(key)) {
        issues.push(`${language}: "${key}" is not used by the code`);
      }
    }
  }
  return issues;
}

const [command, ...args] = process.argv[1] === import.meta.filename ? process.argv.slice(2) : [];

if (command === 'extract') {
  const used = usedPhrases();
  const english = englishData(used);
  for (const [ns, data] of Object.entries(english)) {
    writeNamespace('en', ns, data);
  }
  process.stdout.write(`${used.size} phrases written to the English files\n`);
} else if (command === 'check') {
  const issues = problems();
  issues.slice(0, 60).forEach((issue) => process.stdout.write(`${issue}\n`));
  if (issues.length > 60) {
    process.stdout.write(`... and ${issues.length - 60} more\n`);
  }
  process.stdout.write(issues.length === 0 ? 'translations are complete\n' : `${issues.length} problems\n`);
  process.exit(issues.length === 0 ? 0 : 1);
} else if (command === 'todo') {
  const [language, only] = args;
  const used = usedPhrases();
  const have = merged(language);
  const out = {};
  for (const [key, entry] of used) {
    if (only !== undefined && home(entry) !== only) {
      continue;
    }
    if (entry.other === undefined) {
      if (typeof have[key] !== 'string' || have[key].trim() === '') {
        out[key] = key;
      }
    } else {
      for (const category of categories(language)) {
        const form = `${key}_${category}`;
        if (typeof have[form] !== 'string' || have[form].trim() === '') {
          out[form] = category === 'one' ? key : entry.other;
        }
      }
    }
  }
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
} else if (command === 'merge') {
  const [language, file] = args;
  const incoming = JSON.parse(readFileSync(resolve(file), 'utf8'));
  const used = usedPhrases();
  const placeOf = (key) => {
    const base = key.replace(/_(zero|one|two|few|many|other)$/, '');
    const entry = used.get(key) ?? used.get(base);
    return entry === undefined ? null : home(entry);
  };
  const touched = new Set();
  const data = Object.fromEntries(allNamespaces().map((ns) => [ns, readNamespace(language, ns)]));
  let skipped = 0;
  for (const [key, value] of Object.entries(incoming)) {
    const ns = placeOf(key);
    if (ns === null || typeof value !== 'string') {
      skipped += 1;
      process.stderr.write(`skipped: ${key}\n`);
      continue;
    }
    data[ns][key] = value;
    touched.add(ns);
  }
  for (const ns of touched) {
    writeNamespace(language, ns, data[ns]);
  }
  process.stdout.write(`merged ${Object.keys(incoming).length - skipped} phrases into ${[...touched].join(', ')}\n`);
} else if (process.argv[1] === import.meta.filename) {
  process.stdout.write('usage: node scripts/i18n.mjs extract | check | todo <lang> [area] | merge <lang> <file>\n');
  process.exit(command === undefined ? 0 : 1);
}
