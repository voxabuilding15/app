import type { Database } from '@/core';

import type { Unlock, UnlockKind } from '../domain/entities';
import type { UnlockRepository } from '../domain/ports';

interface UnlockRow {
  key: string;
  kind: UnlockKind;
  ref: string;
  xp: number;
  unlocked_at: number;
  seen: number;
}

export class SqliteUnlockRepository implements UnlockRepository {
  constructor(private readonly db: Database) {}

  async all(): Promise<Unlock[]> {
    return this.db
      .getAllSync<UnlockRow>(
        'SELECT key, kind, ref, xp, unlocked_at, seen FROM achievement_unlocks ORDER BY unlocked_at, rowid',
      )
      .map((row) => ({
        key: row.key,
        kind: row.kind,
        ref: row.ref,
        xp: row.xp,
        unlockedAt: row.unlocked_at,
        seen: row.seen === 1,
      }));
  }

  async insertMissing(unlocks: readonly Unlock[]): Promise<void> {
    this.db.withTransactionSync(() => {
      for (const unlock of unlocks) {
        this.db.runSync(
          `INSERT OR IGNORE INTO achievement_unlocks (key, kind, ref, xp, unlocked_at, seen)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [unlock.key, unlock.kind, unlock.ref, unlock.xp, unlock.unlockedAt, unlock.seen ? 1 : 0],
        );
      }
    });
  }

  async markSeen(keys: readonly string[]): Promise<void> {
    this.db.withTransactionSync(() => {
      for (const key of keys) {
        this.db.runSync('UPDATE achievement_unlocks SET seen = 1 WHERE key = ?', [key]);
      }
    });
  }

  async peakXp(): Promise<number> {
    return (
      this.db.getFirstSync<{ peak_xp: number }>(
        'SELECT peak_xp FROM achievement_state WHERE id = 1',
      )?.peak_xp ?? 0
    );
  }

  async raisePeakXp(xp: number): Promise<void> {
    this.db.runSync('UPDATE achievement_state SET peak_xp = MAX(peak_xp, ?) WHERE id = 1', [
      Math.floor(xp),
    ]);
  }
}
