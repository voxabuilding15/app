import type { Database, DateKey } from '@/core';

import type { HabitEntry, HabitRecord } from '../domain/entities';
import type { HabitScope } from '../domain/filters';
import type { HabitRepository } from '../domain/ports';

import { toEntries, type HabitRow, type LogRow, type PauseRow } from './habit-mappers';

const SELECT_HABIT = `
  SELECT h.id, h.name, h.notes, h.icon, h.color, h.goal_period, h.goal_count, h.weekdays,
    h.reminder_time, h.start_date, h.archived_at, h.created_at, h.notification_ids,
    EXISTS (SELECT 1 FROM habit_pauses p WHERE p.habit_id = h.id AND p.end_date IS NULL) AS paused,
    c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
  FROM habits h
  LEFT JOIN categories c ON c.id = h.category_id`;

const SCOPE_CLAUSE: Record<HabitScope, string> = {
  active: 'h.archived_at IS NULL',
  archived: 'h.archived_at IS NOT NULL',
};

export class SqliteHabitRepository implements HabitRepository {
  constructor(private readonly db: Database) {}

  async list(scope: HabitScope): Promise<HabitEntry[]> {
    const where = SCOPE_CLAUSE[scope];
    const habits = this.db.getAllSync<HabitRow>(
      `${SELECT_HABIT} WHERE ${where} ORDER BY h.created_at, h.rowid`,
    );
    const logs = this.db.getAllSync<LogRow>(
      `SELECT l.habit_id, l.date, l.count, l.status FROM habit_logs l
       JOIN habits h ON h.id = l.habit_id WHERE ${where} ORDER BY l.habit_id, l.date`,
    );
    const pauses = this.db.getAllSync<PauseRow>(
      `SELECT p.id, p.habit_id, p.start_date, p.end_date FROM habit_pauses p
       JOIN habits h ON h.id = p.habit_id WHERE ${where} ORDER BY p.habit_id, p.start_date`,
    );
    return toEntries(habits, logs, pauses);
  }

  async get(id: string): Promise<HabitEntry | null> {
    const habits = this.db.getAllSync<HabitRow>(`${SELECT_HABIT} WHERE h.id = ?`, [id]);
    const logs = this.db.getAllSync<LogRow>(
      'SELECT habit_id, date, count, status FROM habit_logs WHERE habit_id = ? ORDER BY date',
      [id],
    );
    const pauses = this.db.getAllSync<PauseRow>(
      'SELECT id, habit_id, start_date, end_date FROM habit_pauses WHERE habit_id = ? ORDER BY start_date',
      [id],
    );
    return toEntries(habits, logs, pauses)[0] ?? null;
  }

  async insert(habit: HabitRecord): Promise<void> {
    this.db.runSync(
      `INSERT INTO habits (id, name, notes, icon, color, goal_period, goal_count, weekdays,
         reminder_time, category_id, start_date, archived_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        habit.id,
        habit.name,
        habit.notes,
        habit.icon,
        habit.color,
        habit.period,
        habit.goalCount,
        habit.weekdays,
        habit.reminderTime,
        habit.categoryId,
        habit.startDate,
        habit.archivedAt,
        habit.createdAt,
      ],
    );
  }

  async update(habit: HabitRecord): Promise<void> {
    this.db.runSync(
      `UPDATE habits SET name = ?, notes = ?, icon = ?, color = ?, goal_period = ?, goal_count = ?,
         weekdays = ?, reminder_time = ?, category_id = ? WHERE id = ?`,
      [
        habit.name,
        habit.notes,
        habit.icon,
        habit.color,
        habit.period,
        habit.goalCount,
        habit.weekdays,
        habit.reminderTime,
        habit.categoryId,
        habit.id,
      ],
    );
  }

  async setArchivedAt(id: string, archivedAt: number | null): Promise<void> {
    this.db.runSync('UPDATE habits SET archived_at = ? WHERE id = ?', [archivedAt, id]);
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM habits WHERE id = ?', [id]);
  }

  async setCount(id: string, date: DateKey, count: number): Promise<void> {
    this.writeCount(id, date, count);
  }

  async adjustCount(id: string, date: DateKey, delta: number, max: number): Promise<number> {
    let next = 0;
    this.db.withTransactionSync(() => {
      const current = this.db.getFirstSync<{ count: number; status: string }>(
        'SELECT count, status FROM habit_logs WHERE habit_id = ? AND date = ?',
        [id, date],
      );
      const base = current?.status === 'done' ? current.count : 0;
      next = Math.min(max, Math.max(0, base + delta));
      this.writeCount(id, date, next);
    });
    return next;
  }

  async setSkipped(id: string, date: DateKey, skipped: boolean): Promise<void> {
    if (skipped) {
      this.db.runSync(
        `INSERT INTO habit_logs (habit_id, date, count, status) VALUES (?, ?, 1, 'skipped')
         ON CONFLICT(habit_id, date) DO UPDATE SET count = 1, status = 'skipped'`,
        [id, date],
      );
    } else {
      this.db.runSync(
        `DELETE FROM habit_logs WHERE habit_id = ? AND date = ? AND status = 'skipped'`,
        [id, date],
      );
    }
  }

  async startPause(id: string, pauseId: string, start: DateKey): Promise<void> {
    // The partial unique index allows only one open pause per habit, so a repeat call is ignored.
    this.db.runSync(
      'INSERT OR IGNORE INTO habit_pauses (id, habit_id, start_date) VALUES (?, ?, ?)',
      [pauseId, id, start],
    );
  }

  async endPause(id: string, end: DateKey): Promise<void> {
    this.db.withTransactionSync(() => {
      const open = this.db.getFirstSync<{ id: string; start_date: string }>(
        'SELECT id, start_date FROM habit_pauses WHERE habit_id = ? AND end_date IS NULL',
        [id],
      );
      if (open === null) {
        return;
      }
      if (end <= open.start_date) {
        this.db.runSync('DELETE FROM habit_pauses WHERE id = ?', [open.id]);
      } else {
        this.db.runSync('UPDATE habit_pauses SET end_date = ? WHERE id = ?', [end, open.id]);
      }
    });
  }

  async setNotificationIds(id: string, ids: readonly string[]): Promise<void> {
    this.db.runSync('UPDATE habits SET notification_ids = ? WHERE id = ?', [
      JSON.stringify(ids),
      id,
    ]);
  }

  /** Upserts a 'done' log, or removes it when the count is zero. A skip is replaced either way. */
  private writeCount(id: string, date: DateKey, count: number): void {
    if (count <= 0) {
      this.db.runSync(
        `DELETE FROM habit_logs WHERE habit_id = ? AND date = ? AND status = 'done'`,
        [id, date],
      );
      return;
    }
    this.db.runSync(
      `INSERT INTO habit_logs (habit_id, date, count, status) VALUES (?, ?, ?, 'done')
       ON CONFLICT(habit_id, date) DO UPDATE SET count = excluded.count, status = 'done'`,
      [id, date, count],
    );
  }
}
