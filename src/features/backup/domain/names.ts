export type BackupKind = 'manual' | 'auto' | 'safety';

export const BACKUP_FOLDER = 'backups';

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** `backups/focusflow-20261015-183005-auto.json`, in local time so it reads like the clock. */
export function backupPath(at: number, kind: BackupKind): string {
  const date = new Date(at);
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${BACKUP_FOLDER}/focusflow-${stamp}-${kind}.json`;
}

/** What kind a stored backup is, from its file name; anything else counts as manual. */
export function kindOfName(name: string): BackupKind {
  const match = /-(manual|auto|safety)\.json$/.exec(name);
  return (match?.[1] as BackupKind | undefined) ?? 'manual';
}
