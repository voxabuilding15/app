import type { NoteScope, NoteSortField } from '../domain/filters';

export const SCOPES = [
  { value: 'notes', label: 'Notes' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'archived', label: 'Archive' },
  { value: 'trash', label: 'Trash' },
] as const satisfies readonly { value: NoteScope; label: string }[];

export const SORT_FIELDS: readonly NoteSortField[] = ['updated', 'created', 'title'];

const SORT_LABELS: Record<NoteSortField, string> = {
  updated: 'Last edited',
  created: 'Created',
  title: 'Title',
};

export function sortLabel(field: NoteSortField): string {
  return SORT_LABELS[field];
}
