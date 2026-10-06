import type { NoteScope, NoteSortField } from '../domain/filters';
import { msg } from '@/i18n/msg';

export const SCOPES = [
  { value: 'notes', label: msg('Notes') },
  { value: 'favorites', label: msg('Favorites') },
  { value: 'archived', label: msg('Archive') },
  { value: 'trash', label: msg('Trash') },
] as const satisfies readonly { value: NoteScope; label: string }[];

export const SORT_FIELDS: readonly NoteSortField[] = ['updated', 'created', 'title'];

const SORT_LABELS: Record<NoteSortField, string> = {
  updated: msg('Last edited'),
  created: msg('Created'),
  title: msg('Title'),
};

export function sortLabel(field: NoteSortField): string {
  return SORT_LABELS[field];
}
