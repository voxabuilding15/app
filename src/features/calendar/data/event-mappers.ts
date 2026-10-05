import type { DateKey } from '@/core';

import type { CalendarEvent, EventEntry, EventRecurrence } from '../domain/entities';

export interface EventRow {
  id: string;
  title: string;
  notes: string;
  location: string;
  start_at: number;
  end_at: number;
  all_day: number;
  repeat_unit: EventRecurrence['unit'] | null;
  repeat_interval: number;
  repeat_weekdays: number;
  repeat_until: string | null;
  repeat_count: number | null;
  reminder_offset_minutes: number | null;
  notification_ids: string;
  created_at: number;
  updated_at: number;
  cat_id: string | null;
  cat_name: string | null;
  cat_color: string | null;
}

export interface ExceptionRow {
  event_id: string;
  occurrence_date: string;
}

function parseIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    location: row.location,
    category:
      row.cat_id === null || row.cat_name === null || row.cat_color === null
        ? null
        : { id: row.cat_id, name: row.cat_name, color: row.cat_color },
    start: row.start_at,
    end: row.end_at,
    allDay: row.all_day === 1,
    recurrence:
      row.repeat_unit === null
        ? null
        : {
            unit: row.repeat_unit,
            interval: row.repeat_interval,
            weekdays: row.repeat_weekdays,
            until: row.repeat_until,
            count: row.repeat_count,
          },
    reminderOffsetMinutes: row.reminder_offset_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEntries(
  rows: readonly EventRow[],
  exceptions: readonly ExceptionRow[],
): EventEntry[] {
  const byEvent = new Map<string, DateKey[]>();
  for (const exception of exceptions) {
    const list = byEvent.get(exception.event_id) ?? [];
    list.push(exception.occurrence_date);
    byEvent.set(exception.event_id, list);
  }
  return rows.map((row) => ({
    event: toEvent(row),
    exceptions: byEvent.get(row.id) ?? [],
    notificationIds: parseIds(row.notification_ids),
  }));
}
