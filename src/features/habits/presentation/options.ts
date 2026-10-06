import type { HabitScope, HabitSortField, HabitStatusFilter } from '../domain/filters';
import type { HabitPeriod } from '../domain/entities';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { translatedLabels } from '@/i18n/labels';

export const SCOPES = [
  { value: 'active', label: msg('Active') },
  { value: 'archived', label: msg('Archived') },
] as const satisfies readonly { value: HabitScope; label: string }[];

const SORT_LABELS: Record<HabitSortField, string> = translatedLabels({
  created: msg('Date created'),
  name: msg('Name'),
  streak: msg('Streak'),
  progress: msg('Progress'),
});

export function sortLabel(field: HabitSortField): string {
  return currentTranslator().t(SORT_LABELS[field]);
}

export const SORT_FIELDS = (Object.keys(SORT_LABELS) as HabitSortField[]).map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export const PERIOD_OPTIONS: readonly { value: HabitPeriod; label: string }[] = [
  { value: 'daily', label: msg('Daily') },
  { value: 'weekly', label: msg('Weekly') },
  { value: 'monthly', label: msg('Monthly') },
];

export const STATUS_OPTIONS: readonly { value: HabitStatusFilter; label: string }[] = [
  { value: 'any', label: msg('Any') },
  { value: 'due', label: msg('Due today') },
  { value: 'done', label: msg('Done') },
  { value: 'paused', label: msg('Paused') },
];
