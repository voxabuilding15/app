import type { DueFilter, SortField, TaskScope } from '../domain/filters';
import type { Priority } from '../domain/entities';

const SORT_LABELS: Record<SortField, string> = {
  due: 'Due date',
  priority: 'Priority',
  created: 'Date created',
  title: 'Title',
  completed: 'Date completed',
};

export function sortLabel(field: SortField): string {
  return SORT_LABELS[field];
}

export const SORT_FIELDS: Record<TaskScope, readonly SortField[]> = {
  active: ['due', 'priority', 'created', 'title'],
  completed: ['completed', 'due', 'priority', 'title'],
  archived: ['created', 'due', 'priority', 'title'],
};

export const DUE_OPTIONS: readonly { value: DueFilter; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'No date' },
];

export const PRIORITY_OPTIONS: readonly { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
