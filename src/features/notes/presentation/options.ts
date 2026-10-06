import type { NoteScope, NoteSortField } from '../domain/filters';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { translatedLabels } from '@/i18n/labels';

export const SCOPES = [
  { value: 'notes', label: msg('Notes') },
  { value: 'favorites', label: msg('Favorites') },
  { value: 'archived', label: msg('Archive') },
  { value: 'trash', label: msg('Trash') },
] as const satisfies readonly { value: NoteScope; label: string }[];

export const SORT_FIELDS: readonly NoteSortField[] = ['updated', 'created', 'title'];

const SORT_LABELS: Record<NoteSortField, string> = translatedLabels({
  updated: msg('Last edited'),
  created: msg('Created'),
  title: msg('Title'),
});

export function sortLabel(field: NoteSortField): string {
  return currentTranslator().t(SORT_LABELS[field]);
}
