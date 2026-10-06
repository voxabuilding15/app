import type { KeyValueStorage } from './ports';

export const PRIVACY_KEY = 'settings.privacy';

export interface PrivacySettings {
  /** Notifications show only "FocusFlow" instead of what they are about. */
  hideNotificationDetails: boolean;
}

export const DEFAULT_PRIVACY: PrivacySettings = { hideNotificationDetails: false };

export function readPrivacy(storage: KeyValueStorage): PrivacySettings {
  const raw = storage.getString(PRIVACY_KEY);
  if (raw === undefined) {
    return DEFAULT_PRIVACY;
  }
  try {
    const data = JSON.parse(raw) as Partial<PrivacySettings>;
    return { hideNotificationDetails: data.hideNotificationDetails === true };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

export function writePrivacy(storage: KeyValueStorage, settings: PrivacySettings): void {
  storage.setString(PRIVACY_KEY, JSON.stringify(settings));
}
