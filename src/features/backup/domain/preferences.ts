import type { KeyValueStorage } from '@/core';

/**
 * The settings that travel with a backup. Security settings (the app lock and the notes lock) are
 * left out on purpose: a PIN hash has no business sitting in a file that can be shared.
 */
const PREFERENCE_KEYS: readonly string[] = [
  'theme-preference',
  'language-preference',
  'finance.currency',
  'pomodoro.settings',
  'settings.privacy',
];

export function readPreferences(storage: KeyValueStorage): Record<string, string> {
  const found: Record<string, string> = {};
  for (const key of PREFERENCE_KEYS) {
    const value = storage.getString(key);
    if (value !== undefined) {
      found[key] = value;
    }
  }
  return found;
}

/** Applies preferences from a backup. Unknown keys are ignored. */
export function writePreferences(
  storage: KeyValueStorage,
  incoming: Readonly<Record<string, string>>,
  overwrite: boolean,
): void {
  for (const key of PREFERENCE_KEYS) {
    const value = incoming[key];
    if (value !== undefined && (overwrite || storage.getString(key) === undefined)) {
      storage.setString(key, value);
    }
  }
}

/** Everything kept outside the database that goes when the app is reset; theme and language stay. */
const RESET_KEYS: readonly string[] = [
  ...PREFERENCE_KEYS.filter((key) => key !== 'theme-preference' && key !== 'language-preference'),
  'notes.lock',
  'notes.widget',
  'security.applock',
  'security.settings',
  'backup.settings',
  'backup.last-auto',
  'pomodoro.timer',
  'pomodoro.alerts',
];

export function clearPreferences(storage: KeyValueStorage): void {
  for (const key of RESET_KEYS) {
    storage.remove(key);
  }
}
