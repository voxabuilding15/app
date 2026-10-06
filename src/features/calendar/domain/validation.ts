import { DAY_MINUTES, MAX_RECURRENCE_INTERVAL, toDateKey } from '@/core';

import type { EventRecurrence } from './entities';
import { currentTranslator } from '@/i18n/translate';

export const EVENT_TITLE_MAX_LENGTH = 120;
export const EVENT_NOTES_MAX_LENGTH = 5_000;
export const EVENT_LOCATION_MAX_LENGTH = 200;
export const MAX_OCCURRENCE_COUNT = 999;

const TIMED_OFFSETS: readonly number[] = [0, 5, 10, 15, 30, 60, DAY_MINUTES];
const ALL_DAY_OFFSETS: readonly number[] = [0, DAY_MINUTES];

/** Reminder choices (minutes before the start) that make sense for the event kind. */
export function eventReminderOffsetsFor(allDay: boolean): readonly number[] {
  return allDay ? ALL_DAY_OFFSETS : TIMED_OFFSETS;
}

export interface EventDraft {
  title: string;
  notes: string;
  location: string;
  categoryId: string | null;
  allDay: boolean;
  /** Epoch ms. For all-day events, local midnight of the first day. */
  start: number;
  /** Epoch ms, exclusive. For all-day events, local midnight after the last day. */
  end: number;
  recurrence: EventRecurrence | null;
  reminderOffsetMinutes: number | null;
}

export type EventDraftField = 'title' | 'notes' | 'location' | 'time' | 'repeat' | 'reminder';
export type EventDraftErrors = Partial<Record<EventDraftField, string>>;

export function validateEventDraft(draft: EventDraft): EventDraftErrors {
  const { t } = currentTranslator();
  const errors: EventDraftErrors = {};
  const title = draft.title.trim();

  if (title.length === 0) {
    errors.title = t('Enter a title');
  } else if (title.length > EVENT_TITLE_MAX_LENGTH) {
    errors.title = t('Title must be {max} characters or fewer', { max: EVENT_TITLE_MAX_LENGTH });
  }
  if (draft.notes.length > EVENT_NOTES_MAX_LENGTH) {
    errors.notes = t('Notes must be {max} characters or fewer', { max: EVENT_NOTES_MAX_LENGTH });
  }
  if (draft.location.length > EVENT_LOCATION_MAX_LENGTH) {
    errors.location = t('Location must be {max} characters or fewer', {
      max: EVENT_LOCATION_MAX_LENGTH,
    });
  }
  if (!(draft.end > draft.start)) {
    errors.time = draft.allDay
      ? t('The last day cannot be before the first')
      : t('The event must end after it starts');
  }

  const rule = draft.recurrence;
  if (rule !== null) {
    if (
      !Number.isInteger(rule.interval) ||
      rule.interval < 1 ||
      rule.interval > MAX_RECURRENCE_INTERVAL
    ) {
      errors.repeat = t('Repeat interval must be between 1 and {max}', {
        max: MAX_RECURRENCE_INTERVAL,
      });
    } else if (rule.until !== null && rule.count !== null) {
      errors.repeat = t('Choose either an end date or a number of repeats');
    } else if (rule.until !== null && rule.until < toDateKey(draft.start)) {
      errors.repeat = t('The repeat cannot end before the event starts');
    } else if (
      rule.count !== null &&
      (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > MAX_OCCURRENCE_COUNT)
    ) {
      errors.repeat = t('Repeat count must be between 1 and {max}', { max: MAX_OCCURRENCE_COUNT });
    }
  }

  if (
    draft.reminderOffsetMinutes !== null &&
    !eventReminderOffsetsFor(draft.allDay).includes(draft.reminderOffsetMinutes)
  ) {
    errors.reminder = t('Choose a valid reminder time');
  }
  return errors;
}

export function hasEventErrors(errors: EventDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
