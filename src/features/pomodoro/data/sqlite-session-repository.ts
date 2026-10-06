import type { Category, Database } from '@/core';

import type { FocusRow, HistoryQuery, LinkTotal, Session, SessionRecord } from '../domain/entities';
import type { SessionRepository } from '../domain/ports';
import type { SessionOutcome, TimerKind } from '../domain/timer';

interface SessionRow {
  id: string;
  kind: TimerKind;
  planned_seconds: number;
  duration_seconds: number;
  started_at: number;
  ended_at: number;
  outcome: SessionOutcome;
  pauses: number;
  deep_focus: number | null;
  note: string;
  task_id: string | null;
  habit_id: string | null;
  task_title: string | null;
  habit_name: string | null;
}

interface TagRow {
  session_id: string;
  id: string;
  name: string;
  color: string;
}

const COLUMNS = `s.id, s.kind, s.planned_seconds, s.duration_seconds, s.started_at, s.ended_at,
  s.outcome, s.pauses, s.deep_focus, s.note, s.task_id, s.habit_id`;

/** Escapes LIKE wildcards so searching for "50%" matches the text, not everything. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`;
}

const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async insert(record: SessionRecord): Promise<void> {
    this.db.withTransactionSync(() => {
      // A task or habit deleted since the session started is simply left unlinked.
      this.db.runSync(
        `INSERT OR IGNORE INTO pomodoro_sessions (id, kind, planned_seconds, duration_seconds, started_at,
           ended_at, outcome, pauses, deep_focus, note, task_id, habit_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           (SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL),
           (SELECT id FROM habits WHERE id = ?))`,
        [
          record.id,
          record.kind,
          record.plannedSeconds,
          record.durationSeconds,
          record.startedAt,
          record.endedAt,
          record.outcome,
          record.pauses,
          record.deepFocus,
          record.note,
          record.taskId,
          record.habitId,
        ],
      );
      this.setTags(record.id, record.tagIds);
    });
  }

  async get(id: string): Promise<SessionRecord | null> {
    const row = this.db.getFirstSync<SessionRow>(
      `SELECT ${COLUMNS} FROM pomodoro_sessions s WHERE s.id = ?`,
      [id],
    );
    if (row === null) {
      return null;
    }
    const tags = this.db.getAllSync<{ category_id: string }>(
      'SELECT category_id FROM pomodoro_session_tags WHERE session_id = ? ORDER BY category_id',
      [id],
    );
    return {
      id: row.id,
      kind: row.kind,
      plannedSeconds: row.planned_seconds,
      durationSeconds: row.duration_seconds,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      outcome: row.outcome,
      pauses: row.pauses,
      deepFocus: row.deep_focus,
      note: row.note,
      taskId: row.task_id,
      habitId: row.habit_id,
      tagIds: tags.map((tag) => tag.category_id),
    };
  }

  async list(query: HistoryQuery, limit: number): Promise<Session[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (query.scope !== 'all') {
      conditions.push(query.scope === 'focus' ? "s.kind = 'focus'" : "s.kind <> 'focus'");
    }
    if (query.search !== '') {
      const pattern = likePattern(query.search);
      conditions.push(`(s.note LIKE ? ESCAPE '\\' OR t.title LIKE ? ESCAPE '\\'
        OR h.name LIKE ? ESCAPE '\\' OR EXISTS (
          SELECT 1 FROM pomodoro_session_tags st JOIN categories c ON c.id = st.category_id
          WHERE st.session_id = s.id AND c.name LIKE ? ESCAPE '\\'))`);
      params.push(pattern, pattern, pattern, pattern);
    }
    const rows = this.db.getAllSync<SessionRow>(
      `SELECT ${COLUMNS}, t.title AS task_title, h.name AS habit_name
       FROM pomodoro_sessions s
       LEFT JOIN tasks t ON t.id = s.task_id
       LEFT JOIN habits h ON h.id = s.habit_id
       ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY s.started_at DESC, s.rowid DESC LIMIT ?`,
      [...params, limit],
    );
    const tags = this.tagsFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      plannedSeconds: row.planned_seconds,
      durationSeconds: row.duration_seconds,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      outcome: row.outcome,
      pauses: row.pauses,
      deepFocus: row.deep_focus,
      note: row.note,
      task:
        row.task_id !== null && row.task_title !== null
          ? { id: row.task_id, title: row.task_title }
          : null,
      habit:
        row.habit_id !== null && row.habit_name !== null
          ? { id: row.habit_id, title: row.habit_name }
          : null,
      tags: tags.get(row.id) ?? [],
    }));
  }

  async updateDetails(
    id: string,
    details: Pick<SessionRecord, 'note' | 'taskId' | 'habitId' | 'tagIds'>,
  ): Promise<void> {
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `UPDATE pomodoro_sessions SET note = ?,
           task_id = (SELECT id FROM tasks WHERE id = ? AND deleted_at IS NULL),
           habit_id = (SELECT id FROM habits WHERE id = ?)
         WHERE id = ?`,
        [details.note, details.taskId, details.habitId, id],
      );
      this.db.runSync('DELETE FROM pomodoro_session_tags WHERE session_id = ?', [id]);
      this.setTags(id, details.tagIds);
    });
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM pomodoro_sessions WHERE id = ?', [id]);
  }

  async listFocus(from: number, to: number): Promise<FocusRow[]> {
    const rows = this.db.getAllSync<{
      started_at: number;
      duration_seconds: number;
      planned_seconds: number;
      outcome: SessionOutcome;
      deep_focus: number | null;
    }>(
      `SELECT started_at, duration_seconds, planned_seconds, outcome, deep_focus
       FROM pomodoro_sessions
       WHERE kind = 'focus' AND started_at >= ? AND started_at < ?
       ORDER BY started_at`,
      [from, to],
    );
    return rows.map((row) => ({
      startedAt: row.started_at,
      durationSeconds: row.duration_seconds,
      plannedSeconds: row.planned_seconds,
      outcome: row.outcome,
      deepFocus: row.deep_focus,
    }));
  }

  async linkTotals(from: number, to: number, limit: number): Promise<LinkTotal[]> {
    return this.db.getAllSync<LinkTotal>(
      `SELECT kind, id, title, seconds FROM (
         SELECT 'task' AS kind, t.id AS id, t.title AS title, SUM(s.duration_seconds) AS seconds
         FROM pomodoro_sessions s JOIN tasks t ON t.id = s.task_id
         WHERE s.kind = 'focus' AND s.started_at >= ? AND s.started_at < ?
         GROUP BY t.id
         UNION ALL
         SELECT 'habit', h.id, h.name, SUM(s.duration_seconds)
         FROM pomodoro_sessions s JOIN habits h ON h.id = s.habit_id
         WHERE s.kind = 'focus' AND s.started_at >= ? AND s.started_at < ?
         GROUP BY h.id
       ) WHERE seconds > 0 ORDER BY seconds DESC, title COLLATE NOCASE LIMIT ?`,
      [from, to, from, to, limit],
    );
  }

  private setTags(sessionId: string, tagIds: readonly string[]): void {
    for (const tagId of tagIds) {
      // A tag deleted in the meantime is skipped rather than failing the save.
      this.db.runSync(
        `INSERT OR IGNORE INTO pomodoro_session_tags (session_id, category_id)
         SELECT ?, id FROM categories WHERE id = ? AND kind = 'pomodoro'`,
        [sessionId, tagId],
      );
    }
  }

  private tagsFor(ids: readonly string[]): Map<string, Category[]> {
    const byId = new Map<string, Category[]>();
    if (ids.length === 0) {
      return byId;
    }
    const rows = this.db.getAllSync<TagRow>(
      `SELECT st.session_id, c.id, c.name, c.color FROM pomodoro_session_tags st
       JOIN categories c ON c.id = st.category_id
       WHERE st.session_id IN (${placeholders(ids.length)}) ORDER BY c.name COLLATE NOCASE`,
      [...ids],
    );
    for (const row of rows) {
      byId.set(row.session_id, [
        ...(byId.get(row.session_id) ?? []),
        { id: row.id, name: row.name, color: row.color },
      ]);
    }
    return byId;
  }
}
