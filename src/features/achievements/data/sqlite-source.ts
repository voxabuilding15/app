import { addDaysToKey, toDateKey, type Database, type DateKey } from '@/core';

import { dayStart } from '../../statistics/domain/range';
import type { Counters, Lifetime } from '../domain/entities';
import type { AchievementSource } from '../domain/ports';

interface CountRow {
  total: number | null;
}

export class SqliteAchievementSource implements AchievementSource {
  constructor(private readonly db: Database) {}

  private number(sql: string, params: (string | number)[] = []): number {
    return this.db.getFirstSync<CountRow>(sql, params)?.total ?? 0;
  }

  async lifetime(): Promise<Lifetime> {
    const focus = this.db.getFirstSync<{
      sessions: number;
      seconds: number | null;
      longest: number | null;
    }>(
      `SELECT COUNT(*) AS sessions, SUM(duration_seconds) AS seconds, MAX(duration_seconds) AS longest
       FROM pomodoro_sessions WHERE kind = 'focus' AND outcome = 'completed'`,
    );
    return {
      tasks: this.number(
        'SELECT COUNT(*) AS total FROM tasks WHERE completed_at IS NOT NULL AND deleted_at IS NULL',
      ),
      checkIns: this.number("SELECT SUM(count) AS total FROM habit_logs WHERE status = 'done'"),
      focusSessions: focus?.sessions ?? 0,
      focusMinutes: Math.floor((focus?.seconds ?? 0) / 60),
      longestFocusMinutes: Math.floor((focus?.longest ?? 0) / 60),
      notes: this.number('SELECT COUNT(*) AS total FROM notes WHERE deleted_at IS NULL'),
      events: this.number('SELECT COUNT(*) AS total FROM events'),
      transactions: this.number('SELECT COUNT(*) AS total FROM transactions'),
    };
  }

  async activeDays(): Promise<DateKey[]> {
    const days = new Set<DateKey>();
    for (const row of this.db.getAllSync<{ date: string }>(
      "SELECT DISTINCT date FROM habit_logs WHERE status = 'done'",
    )) {
      days.add(row.date);
    }
    for (const row of this.db.getAllSync<{ at: number }>(
      'SELECT completed_at AS at FROM tasks WHERE completed_at IS NOT NULL AND deleted_at IS NULL',
    )) {
      days.add(toDateKey(row.at));
    }
    for (const row of this.db.getAllSync<{ at: number }>(
      "SELECT started_at AS at FROM pomodoro_sessions WHERE kind = 'focus' AND outcome = 'completed'",
    )) {
      days.add(toDateKey(row.at));
    }
    return [...days].sort();
  }

  async between(from: DateKey, to: DateKey): Promise<Counters> {
    const start = dayStart(from);
    const end = dayStart(addDaysToKey(to, 1));
    const focus = this.db.getFirstSync<{ sessions: number; seconds: number | null }>(
      `SELECT COUNT(*) AS sessions, SUM(duration_seconds) AS seconds FROM pomodoro_sessions
       WHERE kind = 'focus' AND outcome = 'completed' AND started_at >= ? AND started_at < ?`,
      [start, end],
    );
    return {
      tasks: this.number(
        `SELECT COUNT(*) AS total FROM tasks
         WHERE completed_at >= ? AND completed_at < ? AND deleted_at IS NULL`,
        [start, end],
      ),
      checkIns: this.number(
        "SELECT SUM(count) AS total FROM habit_logs WHERE status = 'done' AND date >= ? AND date <= ?",
        [from, to],
      ),
      focusSessions: focus?.sessions ?? 0,
      focusMinutes: Math.floor((focus?.seconds ?? 0) / 60),
      notes: this.number(
        'SELECT COUNT(*) AS total FROM notes WHERE created_at >= ? AND created_at < ? AND deleted_at IS NULL',
        [start, end],
      ),
      events: this.number(
        'SELECT COUNT(*) AS total FROM events WHERE created_at >= ? AND created_at < ?',
        [start, end],
      ),
      transactions: this.number(
        'SELECT COUNT(*) AS total FROM transactions WHERE created_at >= ? AND created_at < ?',
        [start, end],
      ),
    };
  }
}
