import type { Clock, FileService, KeyValueStorage, StoredFile } from '@/core';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  checksumOf,
  parseBackup,
  serializeBackup,
  type Backup,
  type BackupFile,
  type ParseFailure,
  type Row,
  type TableData,
} from './format';
import { planMerge, totals, type ConflictPolicy } from './merge';
import { BACKUP_FOLDER, backupPath, kindOfName, type BackupKind } from './names';
import { readPreferences, writePreferences } from './preferences';
import { RestoreError, type ApplyResult, type BackupStore, type RestoreEffects } from './ports';
import { BackupSettingsStore, FREQUENCY_MS, type AutoBackupSettings } from './settings';
import { projectAll } from './schema';

/** Where note attachments are listed, so their files can travel with the backup. */
const ATTACHMENT_TABLE = 'note_attachments';
const ATTACHMENT_PATH = 'path';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_BYTES = 50 * 1024 * 1024;
/** Safety copies made before a restore, kept in case the restore was a mistake. */
const KEEP_BEFORE_RESTORE = 3;

export interface BackupSummary {
  createdAt: number;
  appVersion: string;
  schemaVersion: number;
  rows: number;
  files: number;
  skippedFiles: number;
  /** Rows per table, for tables that have any. */
  tables: { table: string; rows: number }[];
}

export type InspectResult =
  { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; reason: ParseFailure };

export interface StoredBackup {
  file: StoredFile;
  kind: BackupKind;
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreOptions {
  mode: RestoreMode;
  /** Only used when merging. */
  policy: ConflictPolicy;
}

export interface RestoreResult extends ApplyResult {
  mode: RestoreMode;
  /** The copy of the data made just before restoring. */
  safetyCopy: StoredFile;
  filesRestored: number;
}

interface BackupDeps {
  store: BackupStore;
  files: FileService;
  storage: KeyValueStorage;
  clock: Clock;
  effects: RestoreEffects;
  appVersion: string;
  appName: string;
}

const attachmentPaths = (rows: readonly Row[] | undefined): string[] =>
  (rows ?? [])
    .map((row) => row[ATTACHMENT_PATH])
    .filter((path): path is string => typeof path === 'string');

function summarize(backup: Backup): BackupSummary {
  const tables = Object.entries(backup.tables)
    .map(([table, rows]) => ({ table, rows: rows.length }))
    .filter((entry) => entry.rows > 0);
  return {
    createdAt: backup.createdAt,
    appVersion: backup.app.version,
    schemaVersion: backup.schemaVersion,
    rows: tables.reduce((sum, entry) => sum + entry.rows, 0),
    files: backup.files.length,
    skippedFiles: backup.skippedFiles,
    tables,
  };
}

export function createBackupUseCases({
  store,
  files,
  storage,
  clock,
  effects,
  appVersion,
  appName,
}: BackupDeps) {
  const settingsStore = new BackupSettingsStore(storage);

  async function listBackups(): Promise<StoredBackup[]> {
    const found = await files.list('documents', BACKUP_FOLDER);
    return found
      .filter((file) => file.name.endsWith('.json'))
      .map((file) => ({ file, kind: kindOfName(file.name) }));
  }

  /** Deletes the oldest backups of a kind beyond `keep`. */
  async function prune(kind: BackupKind, keep: number): Promise<void> {
    const old = (await listBackups()).filter((entry) => entry.kind === kind).slice(keep);
    await Promise.all(old.map((entry) => files.remove('documents', entry.file.path)));
  }

  async function collect(includeFiles: boolean): Promise<Backup> {
    const schema = await store.schema();
    const data = projectAll(schema, await store.readAll());

    const attached: BackupFile[] = [];
    let skippedFiles = 0;
    if (includeFiles) {
      let total = 0;
      const dropped = new Set<string>();
      for (const path of attachmentPaths(data[ATTACHMENT_TABLE])) {
        const base64 = await files.readBase64('documents', path);
        const bytes = base64 === null ? 0 : Math.floor((base64.length * 3) / 4);
        if (base64 === null || bytes > MAX_FILE_BYTES || total + bytes > MAX_FILES_BYTES) {
          dropped.add(path);
          skippedFiles += 1;
        } else {
          total += bytes;
          attached.push({ path, base64 });
        }
      }
      // A row whose file is not in the backup would restore as a broken attachment.
      data[ATTACHMENT_TABLE] = (data[ATTACHMENT_TABLE] ?? []).filter(
        (row) => !dropped.has(String(row[ATTACHMENT_PATH])),
      );
    } else {
      skippedFiles = attachmentPaths(data[ATTACHMENT_TABLE]).length;
      data[ATTACHMENT_TABLE] = [];
    }

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      app: { name: appName, version: appVersion },
      schemaVersion: store.schemaVersion(),
      createdAt: clock.now(),
      checksum: checksumOf(data),
      tables: data,
      preferences: readPreferences(storage),
      files: attached,
      skippedFiles,
    };
  }

  async function create(kind: BackupKind, includeFiles: boolean): Promise<StoredBackup> {
    const backup = await collect(includeFiles);
    const file = await files.writeText(
      'documents',
      backupPath(clock.now(), kind),
      serializeBackup(backup),
    );
    if (kind === 'before-restore') {
      await prune(kind, KEEP_BEFORE_RESTORE);
    }
    return { file, kind };
  }

  async function localData(): Promise<TableData> {
    return projectAll(await store.schema(), await store.readAll());
  }

  return {
    /** Writes a backup into the app's backup folder. */
    create,

    /** Makes a backup and hands it to the share sheet, so it can be kept elsewhere. */
    async exportAndShare(
      includeFiles: boolean,
      title: string,
    ): Promise<{ file: StoredFile; shared: boolean }> {
      const { file } = await create('manual', includeFiles);
      return { file, shared: await files.share(file, 'application/json', title) };
    },

    list: listBackups,

    remove(path: string): Promise<void> {
      return files.remove('documents', path);
    },

    readStored(path: string): Promise<string> {
      return files.readText('documents', path);
    },

    /** Opens the system file chooser for a backup file; null when the person cancels. */
    pickFile() {
      return files.pick(['application/json', 'text/plain', 'application/octet-stream']);
    },

    share(file: StoredFile, title: string): Promise<boolean> {
      return files.share(file, 'application/json', title);
    },

    readPicked(uri: string): Promise<string> {
      return files.readPickedText(uri);
    },

    /** Checks backup text and describes what is in it. Changes nothing. */
    inspect(text: string): InspectResult {
      const parsed = parseBackup(text, store.schemaVersion());
      return parsed.ok
        ? { ok: true, backup: parsed.backup, summary: summarize(parsed.backup) }
        : parsed;
    },

    /** What merging the backup would do on this device, table by table. */
    async analyze(backup: Backup, policy: ConflictPolicy) {
      const schema = await store.schema();
      const { analysis } = planMerge(
        schema,
        await localData(),
        projectAll(schema, backup.tables),
        policy,
      );
      return { tables: analysis, totals: totals(analysis) };
    },

    /**
     * Puts a backup on this device. A copy of the current data is saved first, and the change to the
     * database is all or nothing, so a failed restore leaves everything as it was.
     */
    async restore(backup: Backup, { mode, policy }: RestoreOptions): Promise<RestoreResult> {
      const schema = await store.schema();
      const incoming = projectAll(schema, backup.tables);
      const before = await localData();
      const safety = await create('before-restore', true);

      const applied =
        mode === 'replace'
          ? await store.replaceAll(incoming)
          : await store.merge(planMerge(schema, before, incoming, policy).plan);

      writePreferences(storage, backup.preferences, mode === 'replace' || policy === 'keep-backup');

      let filesRestored = 0;
      for (const file of backup.files) {
        if (
          mode === 'merge' &&
          policy !== 'keep-backup' &&
          (await files.exists('documents', file.path))
        ) {
          continue;
        }
        await files.writeBase64('documents', file.path, file.base64);
        filesRestored += 1;
      }
      if (mode === 'replace') {
        // Attachments of notes that no longer exist would only take up room.
        const keep = new Set(attachmentPaths(incoming[ATTACHMENT_TABLE]));
        for (const path of attachmentPaths(before[ATTACHMENT_TABLE])) {
          if (!keep.has(path)) {
            await files.remove('documents', path);
          }
        }
      }

      await effects.afterRestore();
      return { ...applied, mode, safetyCopy: safety.file, filesRestored };
    },

    autoSettings: (): AutoBackupSettings => settingsStore.read(),

    saveAutoSettings(settings: AutoBackupSettings): void {
      settingsStore.write(settings);
    },

    lastAutoBackupAt: () => settingsStore.lastAutoAt(),

    /** Makes an automatic backup when one is due. Returns it, or null when nothing was needed. */
    async runAutoBackupIfDue(): Promise<StoredBackup | null> {
      const settings = settingsStore.read();
      if (!settings.enabled) {
        return null;
      }
      const last = settingsStore.lastAutoAt();
      const now = clock.now();
      if (last !== null && now - last < FREQUENCY_MS[settings.frequency]) {
        return null;
      }
      const made = await create('auto', settings.includeFiles);
      settingsStore.markAuto(now);
      await prune('auto', settings.keep);
      return made;
    },
  };
}

export type BackupUseCases = ReturnType<typeof createBackupUseCases>;
export { RestoreError };
