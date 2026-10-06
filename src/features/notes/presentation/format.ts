import type { IconName } from '@/components';
import { DAY_MINUTES, MINUTE_MS, startOfDay } from '@/core';

import type { AttachmentKind, NoteSummary } from '../domain/entities';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';

export const ATTACHMENT_ICON: Record<AttachmentKind, IconName> = {
  image: 'image',
  pdf: 'picture-as-pdf',
  audio: 'mic',
  drawing: 'draw',
};

export const ATTACHMENT_LABEL: Record<AttachmentKind, string> = {
  image: msg('Image'),
  pdf: 'PDF',
  audio: msg('Voice recording'),
  drawing: msg('Drawing'),
};

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function formatDay(at: number, now: number): string {
  const { t } = currentTranslator();
  const today = startOfDay(now);
  const day = startOfDay(at);
  const step = DAY_MINUTES * MINUTE_MS;
  if (day === today) {
    return t('Today');
  }
  if (Math.abs(day - today - step) < step / 2) {
    return t('Tomorrow');
  }
  if (Math.abs(today - day - step) < step / 2) {
    return t('Yesterday');
  }
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatReminder(at: number, now: number): string {
  return `${formatDay(at, now)}, ${formatTime(at)}`;
}

/** "1:05" for 65 seconds. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function displayTitle(title: string): string {
  const { t } = currentTranslator();
  return title.trim() === '' ? t('Untitled') : title;
}

/** Accessible one-sentence summary of a note for screen readers. */
export function describeNote(note: NoteSummary, now: number): string {
  const { t } = currentTranslator();
  const parts = [
    displayTitle(note.title),
    note.locked ? 'locked' : note.preview || null,
    note.pinned ? 'pinned' : null,
    note.favorite ? 'favorite' : null,
    note.folder ? `in ${note.folder.name}` : null,
    note.tags.length > 0
      ? t('tags {join}', { join: note.tags.map((tag) => tag.name).join(', ') })
      : null,
    note.checklistTotal > 0
      ? t('{checklistDone} of {checklistTotal} tasks done', {
          checklistDone: note.checklistDone,
          checklistTotal: note.checklistTotal,
        })
      : null,
    note.attachmentCount > 0
      ? `${note.attachmentCount} ${note.attachmentCount === 1 ? 'attachment' : 'attachments'}`
      : null,
    note.reminderAt === null
      ? null
      : t('reminder {reminder}', { reminder: formatReminder(note.reminderAt, now) }),
  ];
  return parts.filter(Boolean).join(', ');
}
