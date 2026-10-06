import { excerptOf } from './markdown';
import type { NoteSummary } from './entities';
import { currentTranslator } from '@/i18n/translate';

/** Storage key a home screen widget reads the snapshot from. */
export const WIDGET_SNAPSHOT_KEY = 'notes.widget';
export const WIDGET_NOTE_LIMIT = 8;

interface WidgetNote {
  id: string;
  title: string;
  /** A short preview; empty for locked notes. */
  excerpt: string;
  color: string | null;
  pinned: boolean;
  locked: boolean;
  updatedAt: number;
  /** Deep link that opens the note in the app. */
  link: string;
}

/** Plain, serializable data a widget can draw without knowing anything about the app. */
export interface WidgetSnapshot {
  version: 1;
  updatedAt: number;
  notes: WidgetNote[];
}

export function noteLink(id: string): string {
  return `focusflow://notes/${id}`;
}

export function buildWidgetSnapshot(notes: readonly NoteSummary[], now: number): WidgetSnapshot {
  const { t } = currentTranslator();
  return {
    version: 1,
    updatedAt: now,
    notes: notes.slice(0, WIDGET_NOTE_LIMIT).map((note) => ({
      id: note.id,
      title: note.title.trim() || t('Untitled'),
      excerpt: note.locked ? '' : excerptOf(note.preview, 120),
      color: note.color,
      pinned: note.pinned,
      locked: note.locked,
      updatedAt: note.updatedAt,
      link: noteLink(note.id),
    })),
  };
}
