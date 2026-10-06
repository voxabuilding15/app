import type { KeyValueStorage } from '@/core';

/** How long the app may be left before it asks to be unlocked again, in seconds. */
export const LOCK_DELAYS = [0, 60, 300] as const;
export type LockDelay = (typeof LOCK_DELAYS)[number];

export interface SecuritySettings {
  lockDelaySeconds: LockDelay;
}

export const DEFAULT_SECURITY: SecuritySettings = { lockDelaySeconds: 60 };

export const APP_LOCK_STORAGE_KEY = 'security.applock';
const SETTINGS_KEY = 'security.settings';

export class SecuritySettingsStore {
  constructor(private readonly storage: KeyValueStorage) {}

  read(): SecuritySettings {
    const raw = this.storage.getString(SETTINGS_KEY);
    if (raw === undefined) {
      return DEFAULT_SECURITY;
    }
    try {
      const value = (JSON.parse(raw) as Partial<SecuritySettings>).lockDelaySeconds;
      const delay = LOCK_DELAYS.find((option) => option === value);
      return { lockDelaySeconds: delay ?? DEFAULT_SECURITY.lockDelaySeconds };
    } catch {
      return DEFAULT_SECURITY;
    }
  }

  write(settings: SecuritySettings): void {
    this.storage.setString(SETTINGS_KEY, JSON.stringify(settings));
  }
}
