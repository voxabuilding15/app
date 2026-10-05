import type { Database } from '@/core';

import type { TaskItem } from '../domain/items';
import { dayBounds } from '../domain/items';
import type { TaskAgendaSource } from '../domain/ports';
import { toDateKey } from '@/core';

interface TaskRow {
  id: string;
  title: string;
  due_at: number;
  due_has_time: number;
  priority: number;
  completed_at: number | null;
  cat_color: string | null;
}

const PRIORITIES = ['low', 'medium', 'high'] as const;

/** Reads tasks that have a due date, straight from the tasks table (read-only). */
export class SqliteTaskAgendaSource implements TaskAgendaSource {
  constructor(private readonly db: Database) {}

  async dueBetween(from: number, to: number): Promise<TaskItem[]> {
    const rows = this.db.getAllSync<TaskRow>(
      `SELECT t.id, t.title, t.due_at, t.due_has_time, t.priority, t.completed_at,
         c.color AS cat_color
       FROM tasks t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL AND t.archived_at IS NULL
         AND t.due_at >= ? AND t.due_at < ?
       ORDER BY t.due_at`,
      [from, to],
    );
    return rows.map((row) => {
      const allDay = row.due_has_time === 0;
      return {
        kind: 'task',
        key: `task:${row.id}`,
        taskId: row.id,
        title: row.title,
        start: row.due_at,
        end: allDay ? dayBounds(toDateKey(row.due_at)).end : row.due_at,
        allDay,
        color: row.cat_color,
        done: row.completed_at !== null,
        priority: PRIORITIES[row.priority] ?? 'medium',
      };
    });
  }
}
