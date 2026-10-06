import type { IconName } from '@/components';
import { DAY_MINUTES, MINUTE_MS, startOfDay } from '@/core';

import type { AttachmentKind, NoteSummary } from '../domain/entities';

export const ATTACHMENT_ICON: Record<AttachmentKind, IconName> = {
  image: 'image',
  pdf: 'picture-as-pdf',
  audio: 'mic',
  drawing: 'draw',
};

export const ATTACHMENT_LABEL: Record<AttachmentKind, string> = {
  image: 'Image',
  pdf: 'PDF',
  audio: 'Voice recording',
  drawing: 'Drawing',
};

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function formatDay(at: number, now: number): string {
  const today = startOfDay(now);
  const day = startOfDay(at);
  const step = DAY_MINUTES * MINUTE_MS;
  if (day === today) {
    return 'Today';
  }
  if (Math.abs(day - today - step) < step / 2) {
    return 'Tomorrow';
  }
  if (Math.abs(today - day - step) < step / 2) {
    return 'Yesterday';
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
  return title.trim() === '' ? 'Untitled' : title;
}

/** Accessible one-sentence summary of a note for screen readers. */
export function describeNote(note: NoteSummary, now: number): string {
  const parts = [
    displayTitle(note.title),
    note.locked ? 'locked' : note.preview || null,
    note.pinned ? 'pinned' : null,
    note.favorite ? 'favorite' : null,
    note.folder ? `in ${note.folder.name}` : null,
    note.tags.length > 0 ? `tags ${note.tags.map((tag) => tag.name).join(', ')}` : null,
    note.checklistTotal > 0 ? `${note.checklistDone} of ${note.checklistTotal} tasks done` : null,
    note.attachmentCount > 0
      ? `${note.attachmentCount} ${note.attachmentCount === 1 ? 'attachment' : 'attachments'}`
      : null,
    note.reminderAt === null ? null : `reminder ${formatReminder(note.reminderAt, now)}`,
  ];
  return parts.filter(Boolean).join(', ');
}
