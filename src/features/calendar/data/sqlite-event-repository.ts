import type { Database, DateKey } from '@/core';

import type { EventEntry, EventRecord } from '../domain/entities';
import type { EventRepository } from '../domain/ports';

import { toEntries, type EventRow, type ExceptionRow } from './event-mappers';

const SELECT_EVENT = `
  SELECT e.id, e.title, e.notes, e.location, e.start_at, e.end_at, e.all_day,
    e.repeat_unit, e.repeat_interval, e.repeat_weekdays, e.repeat_until, e.repeat_count,
    e.reminder_offset_minutes, e.notification_ids, e.created_at, e.updated_at,
    c.id AS cat_id, c.name AS cat_name, c.color AS cat_color
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id`;

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: Database) {}

  async listInRange(from: number, to: number): Promise<EventEntry[]> {
    const rows = this.db.getAllSync<EventRow>(
      `${SELECT_EVENT}
       WHERE (e.repeat_unit IS NULL AND e.start_at < ? AND e.end_at > ?)
          OR (e.repeat_unit IS NOT NULL AND e.start_at < ?)
       ORDER BY e.start_at, e.id`,
      [to, from, to],
    );
    return this.withExceptions(rows);
  }

  async listWithReminders(now: number): Promise<EventEntry[]> {
    const rows = this.db.getAllSync<EventRow>(
      `${SELECT_EVENT}
       WHERE e.reminder_offset_minutes IS NOT NULL AND (e.repeat_unit IS NOT NULL OR e.end_at > ?)
       ORDER BY e.start_at, e.id`,
      [now],
    );
    return this.withExceptions(rows);
  }

  async get(id: string): Promise<EventEntry | null> {
    const rows = this.db.getAllSync<EventRow>(`${SELECT_EVENT} WHERE e.id = ?`, [id]);
    return (await this.withExceptions(rows))[0] ?? null;
  }

  async insert(event: EventRecord): Promise<void> {
    this.db.runSync(
      `INSERT INTO events (id, title, notes, location, category_id, start_at, end_at, all_day,
         repeat_unit, repeat_interval, repeat_weekdays, repeat_until, repeat_count,
         reminder_offset_minutes, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        event.id,
        event.title,
        event.notes,
        event.location,
        event.categoryId,
        event.start,
        event.end,
        event.allDay ? 1 : 0,
        event.recurrence?.unit ?? null,
        event.recurrence?.interval ?? 1,
        event.recurrence?.weekdays ?? 0,
        event.recurrence?.until ?? null,
        event.recurrence?.count ?? null,
        event.reminderOffsetMinutes,
        event.createdAt,
        event.updatedAt,
      ],
    );
  }

  async update(event: EventRecord): Promise<void> {
    this.db.runSync(
      `UPDATE events SET title = ?, notes = ?, location = ?, category_id = ?, start_at = ?,
         end_at = ?, all_day = ?, repeat_unit = ?, repeat_interval = ?, repeat_weekdays = ?,
         repeat_until = ?, repeat_count = ?, reminder_offset_minutes = ?, updated_at = ?
       WHERE id = ?`,
      [
        event.title,
        event.notes,
        event.location,
        event.categoryId,
        event.start,
        event.end,
        event.allDay ? 1 : 0,
        event.recurrence?.unit ?? null,
        event.recurrence?.interval ?? 1,
        event.recurrence?.weekdays ?? 0,
        event.recurrence?.until ?? null,
        event.recurrence?.count ?? null,
        event.reminderOffsetMinutes,
        event.updatedAt,
        event.id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    this.db.runSync('DELETE FROM events WHERE id = ?', [id]);
  }

  async addException(id: string, occurrenceDate: DateKey): Promise<void> {
    this.db.runSync(
      'INSERT OR IGNORE INTO event_exceptions (event_id, occurrence_date) VALUES (?, ?)',
      [id, occurrenceDate],
    );
  }

  async setNotificationIds(id: string, ids: readonly string[]): Promise<void> {
    this.db.runSync('UPDATE events SET notification_ids = ? WHERE id = ?', [
      JSON.stringify(ids),
      id,
    ]);
  }

  private withExceptions(rows: EventRow[]): EventEntry[] {
    const recurringIds = rows.filter((row) => row.repeat_unit !== null).map((row) => row.id);
    const exceptions =
      recurringIds.length === 0
        ? []
        : this.db.getAllSync<ExceptionRow>(
            `SELECT event_id, occurrence_date FROM event_exceptions
             WHERE event_id IN (${recurringIds.map(() => '?').join(',')}) ORDER BY occurrence_date`,
            recurringIds,
          );
    return toEntries(rows, exceptions);
  }
}
