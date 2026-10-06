import type { DueFilter, SortField, TaskScope } from '../domain/filters';
import type { Priority } from '../domain/entities';
import { msg } from '@/i18n/msg';

const SORT_LABELS: Record<SortField, string> = {
  due: msg('Due date'),
  priority: msg('Priority'),
  created: msg('Date created'),
  title: msg('Title'),
  completed: msg('Date completed'),
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
  { value: 'any', label: msg('Any time') },
  { value: 'today', label: msg('Today') },
  { value: 'overdue', label: msg('Overdue') },
  { value: 'upcoming', label: msg('Upcoming') },
  { value: 'none', label: msg('No date') },
];

export const PRIORITY_OPTIONS: readonly { value: Priority; label: string }[] = [
  { value: 'high', label: msg('High') },
  { value: 'medium', label: msg('Medium') },
  { value: 'low', label: msg('Low') },
];
