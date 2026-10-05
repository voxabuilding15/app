import type { HabitScope, HabitSortField, HabitStatusFilter } from '../domain/filters';
import type { HabitPeriod } from '../domain/entities';

export const SCOPES = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
] as const satisfies readonly { value: HabitScope; label: string }[];

const SORT_LABELS: Record<HabitSortField, string> = {
  created: 'Date created',
  name: 'Name',
  streak: 'Streak',
  progress: 'Progress',
};

export function sortLabel(field: HabitSortField): string {
  return SORT_LABELS[field];
}

export const SORT_FIELDS = (Object.keys(SORT_LABELS) as HabitSortField[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export const PERIOD_OPTIONS: readonly { value: HabitPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const STATUS_OPTIONS: readonly { value: HabitStatusFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'due', label: 'Due today' },
  { value: 'done', label: 'Done' },
  { value: 'paused', label: 'Paused' },
];
