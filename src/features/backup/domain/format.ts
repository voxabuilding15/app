import { sha256Hex } from '@/core';

export const BACKUP_FORMAT = 'focusflow-backup';
export const BACKUP_VERSION = 1;

export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export type TableData = Record<string, Row[]>;

export interface BackupFile {
  /** Path inside the app's document folder, with `/` separators. */
  path: string;
  base64: string;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: { name: string; version: string };
  /** The database version the rows were read from. */
  schemaVersion: number;
  createdAt: number;
  /** SHA-256 of the tables, to notice a file that was cut short or edited. */
  checksum: string;
  tables: TableData;
  /** Settings kept outside the database. */
  preferences: Record<string, string>;
  files: BackupFile[];
  /** Attachments left out because they were too large. */
  skippedFiles: number;
}

export type ParseFailure = 'not-json' | 'not-backup' | 'too-new' | 'corrupt';
export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: ParseFailure };

export function checksumOf(tables: TableData): string {
  return sha256Hex(JSON.stringify(tables));
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCell = (value: unknown): value is Cell =>
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));

/** Paths must stay inside the document folder. */
export function isSafePath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length < 300 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((part) => part === '..' || part === '' || part === '.') &&
    /^[\w\-./ ()]+$/.test(path)
  );
}

/**
 * Reads backup text and checks that it really is one, was written by this version of the app or an
 * older one, and has not been damaged. Nothing is trusted: names and values are checked again when
 * they are used.
 */
export function parseBackup(text: string, supportedSchema: number): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'not-backup' };
  }
  const { version, schemaVersion, createdAt, checksum, tables, preferences, files, app } = raw;
  if (typeof version !== 'number' || typeof schemaVersion !== 'number') {
    return { ok: false, reason: 'not-backup' };
  }
  if (version > BACKUP_VERSION || schemaVersion > supportedSchema) {
    return { ok: false, reason: 'too-new' };
  }
  if (
    !Number.isInteger(schemaVersion) ||
    typeof createdAt !== 'number' ||
    typeof checksum !== 'string' ||
    !isRecord(tables) ||
    !isRecord(preferences) ||
    !Array.isArray(files) ||
    !isRecord(app)
  ) {
    return { ok: false, reason: 'corrupt' };
  }

  for (const rows of Object.values(tables)) {
    if (
      !Array.isArray(rows) ||
      !rows.every((row) => isRecord(row) && Object.values(row).every(isCell))
    ) {
      return { ok: false, reason: 'corrupt' };
    }
  }
  if (!Object.values(preferences).every((value) => typeof value === 'string')) {
    return { ok: false, reason: 'corrupt' };
  }
  const validFiles = files.every(
    (file) =>
      isRecord(file) &&
      typeof file.path === 'string' &&
      isSafePath(file.path) &&
      typeof file.base64 === 'string',
  );
  if (!validFiles) {
    return { ok: false, reason: 'corrupt' };
  }
  if (checksumOf(tables as TableData) !== checksum) {
    return { ok: false, reason: 'corrupt' };
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version,
      app: { name: String(app.name ?? ''), version: String(app.version ?? '') },
      schemaVersion,
      createdAt,
      checksum,
      tables: tables as TableData,
      preferences: preferences as Record<string, string>,
      files: files as BackupFile[],
      skippedFiles: typeof raw.skippedFiles === 'number' ? raw.skippedFiles : 0,
    },
  };
}
