import { startOfDay, addDays } from '@/core';
import type { Priority } from '../domain/entities';
import { NO_CATEGORY, type TaskFilter, type TaskSort } from '../domain/filters';

export const PRIORITY_TO_INT: Record<Priority, number> = { low: 0, medium: 1, high: 2 };
export const INT_TO_PRIORITY: readonly Priority[] = ['low', 'medium', 'high'];

export const SELECT_TASK = `
  SELECT t.id, t.title, t.description, t.priority, t.due_at, t.due_has_time,
    t.reminder_offset_minutes, t.reminder_at, t.is_alarm, t.notification_id,
    t.repeat_unit, t.repeat_interval, t.repeat_weekdays,
    t.completed_at, t.archived_at, t.created_at, t.updated_at,
    c.id AS cat_id, c.name AS cat_name, c.color AS cat_color,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS subtask_total,
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.completed = 1) AS subtask_done
  FROM tasks t
  LEFT JOIN categories c ON c.id = t.category_id`;

export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(',');
}

/** Escapes LIKE wildcards so user input is always matched literally. */
function toLikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

type SqlParam = string | number;

interface WhereClause {
  sql: string;
  params: SqlParam[];
}

const SCOPE_CLAUSE = {
  active: 't.completed_at IS NULL AND t.archived_at IS NULL',
  completed: 't.completed_at IS NOT NULL AND t.archived_at IS NULL',
  archived: 't.archived_at IS NOT NULL',
} as const;

export function buildWhere(filter: TaskFilter, now: number): WhereClause {
  const clauses: string[] = ['t.deleted_at IS NULL', SCOPE_CLAUSE[filter.scope]];
  const params: SqlParam[] = [];

  const search = filter.search.trim();
  if (search.length > 0) {
    const pattern = toLikePattern(search);
    clauses.push(
      `(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM subtasks s WHERE s.task_id = t.id AND s.title LIKE ? ESCAPE '\\'))`,
    );
    params.push(pattern, pattern, pattern);
  }

  if (filter.priorities.length > 0) {
    clauses.push(`t.priority IN (${placeholders(filter.priorities.length)})`);
    params.push(...filter.priorities.map((priority) => PRIORITY_TO_INT[priority]));
  }

  if (filter.categoryId === NO_CATEGORY) {
    clauses.push('t.category_id IS NULL');
  } else if (filter.categoryId !== null) {
    clauses.push('t.category_id = ?');
    params.push(filter.categoryId);
  }

  if (filter.labelIds.length > 0) {
    clauses.push(
      `EXISTS (SELECT 1 FROM task_labels tl WHERE tl.task_id = t.id AND tl.label_id IN (${placeholders(filter.labelIds.length)}))`,
    );
    params.push(...filter.labelIds);
  }

  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  switch (filter.due) {
    case 'today':
      clauses.push('t.due_at >= ? AND t.due_at < ?');
      params.push(todayStart, tomorrowStart);
      break;
    case 'overdue':
      clauses.push(
        't.due_at IS NOT NULL AND ((t.due_has_time = 1 AND t.due_at < ?) OR (t.due_has_time = 0 AND t.due_at < ?))',
      );
      params.push(now, todayStart);
      break;
    case 'upcoming':
      clauses.push('t.due_at >= ?');
      params.push(tomorrowStart);
      break;
    case 'none':
      clauses.push('t.due_at IS NULL');
      break;
    default:
      break;
  }

  return { sql: clauses.join(' AND '), params };
}

/** Tasks without a due date always sort last regardless of direction. */
export function buildOrderBy(sort: TaskSort): string {
  const dir = sort.direction === 'asc' ? 'ASC' : 'DESC';
  switch (sort.field) {
    case 'priority':
      return `t.priority ${dir}, (t.due_at IS NULL), t.due_at ASC, t.created_at DESC`;
    case 'created':
      return `t.created_at ${dir}`;
    case 'title':
      return `t.title COLLATE NOCASE ${dir}`;
    case 'completed':
      return `t.completed_at ${dir}`;
    default:
      return `(t.due_at IS NULL), t.due_at ${dir}, t.priority DESC, t.created_at DESC`;
  }
}
