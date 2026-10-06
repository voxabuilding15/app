import type { KeyValueStorage } from '@/core';

export type BackupFrequency = 'daily' | 'weekly';

export interface AutoBackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  /** How many automatic backups to keep. */
  keep: number;
  /** Attachments make backups large, so they are off unless asked for. */
  includeFiles: boolean;
}

export const DEFAULT_AUTO_BACKUP: AutoBackupSettings = {
  enabled: true,
  frequency: 'weekly',
  keep: 5,
  includeFiles: false,
};

export const KEEP_RANGE = { min: 1, max: 30 } as const;
export const FREQUENCY_MS: Record<BackupFrequency, number> = {
  daily: 24 * 3_600_000,
  weekly: 7 * 24 * 3_600_000,
};

const SETTINGS_KEY = 'backup.settings';
const LAST_KEY = 'backup.last-auto';

export function normalizeAutoBackup(raw: unknown): AutoBackupSettings {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const keep = data.keep;
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_AUTO_BACKUP.enabled,
    frequency:
      data.frequency === 'daily' || data.frequency === 'weekly'
        ? data.frequency
        : DEFAULT_AUTO_BACKUP.frequency,
    keep:
      typeof keep === 'number' &&
      Number.isInteger(keep) &&
      keep >= KEEP_RANGE.min &&
      keep <= KEEP_RANGE.max
        ? keep
        : DEFAULT_AUTO_BACKUP.keep,
    includeFiles:
      typeof data.includeFiles === 'boolean' ? data.includeFiles : DEFAULT_AUTO_BACKUP.includeFiles,
  };
}

export class BackupSettingsStore {
  constructor(private readonly storage: KeyValueStorage) {}

  read(): AutoBackupSettings {
    const raw = this.storage.getString(SETTINGS_KEY);
    if (raw === undefined) {
      return DEFAULT_AUTO_BACKUP;
    }
    try {
      return normalizeAutoBackup(JSON.parse(raw));
    } catch {
      return DEFAULT_AUTO_BACKUP;
    }
  }

  write(settings: AutoBackupSettings): void {
    this.storage.setString(SETTINGS_KEY, JSON.stringify(normalizeAutoBackup(settings)));
  }

  lastAutoAt(): number | null {
    const raw = this.storage.getString(LAST_KEY);
    const value = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  markAuto(at: number): void {
    this.storage.setString(LAST_KEY, String(at));
  }
}
