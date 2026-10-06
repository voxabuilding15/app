import type { KeyValueStorage } from '@/core';

/**
 * The settings that travel with a backup. Security settings (the app lock and the notes lock) are
 * left out on purpose: a PIN hash has no business sitting in a file that can be shared.
 */
export const PREFERENCE_KEYS: readonly string[] = [
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
