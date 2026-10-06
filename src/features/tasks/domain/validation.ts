import { MAX_RECURRENCE_INTERVAL } from '@/core';

import type { DueDate, Priority, RepeatRule } from './entities';
import { isValidReminderOffset } from './reminder';
import { currentTranslator } from '@/i18n/translate';

export const TITLE_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 5_000;
const MAX_SUBTASKS = 50;

export interface SubtaskDraft {
  /** Present when editing an existing subtask so its identity is preserved. */
  id: string | null;
  title: string;
  completed: boolean;
}

export interface TaskDraft {
  title: string;
  notes: string;
  priority: Priority;
  categoryId: string | null;
  labelIds: string[];
  due: DueDate | null;
  reminderOffsetMinutes: number | null;
  isAlarm: boolean;
  repeat: RepeatRule | null;
  subtasks: SubtaskDraft[];
}

export type DraftField = 'title' | 'notes' | 'due' | 'reminder' | 'repeat' | 'subtasks';

export type DraftErrors = Partial<Record<DraftField, string>>;

export function emptyDraft(): TaskDraft {
  return {
    title: '',
    notes: '',
    priority: 'medium',
    categoryId: null,
    labelIds: [],
    due: null,
    reminderOffsetMinutes: null,
    isAlarm: false,
    repeat: null,
    subtasks: [],
  };
}

export function validateDraft(draft: TaskDraft): DraftErrors {
  const { t } = currentTranslator();
  const errors: DraftErrors = {};

  if (draft.title.trim().length === 0) {
    errors.title = t('Enter a title');
  } else if (draft.title.trim().length > TITLE_MAX_LENGTH) {
    errors.title = t('Title must be {max} characters or fewer', { max: TITLE_MAX_LENGTH });
  }

  if (draft.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = t('Notes must be {max} characters or fewer', { max: NOTES_MAX_LENGTH });
  }

  if (draft.reminderOffsetMinutes !== null) {
    if (draft.due === null) {
      errors.reminder = t('Set a due date to use a reminder');
    } else if (!isValidReminderOffset(draft.reminderOffsetMinutes, draft.due.hasTime)) {
      errors.reminder = t('Choose a valid reminder time');
    }
  }

  if (draft.repeat !== null) {
    if (draft.due === null) {
      errors.repeat = t('Set a due date to repeat this task');
    } else if (draft.repeat.unit === 'year') {
      errors.repeat = t('Tasks cannot repeat yearly');
    } else if (
      !Number.isInteger(draft.repeat.interval) ||
      draft.repeat.interval < 1 ||
      draft.repeat.interval > MAX_RECURRENCE_INTERVAL
    ) {
      errors.repeat = t('Repeat interval must be between 1 and {max}', {
        max: MAX_RECURRENCE_INTERVAL,
      });
    }
  }

  if (draft.subtasks.length > MAX_SUBTASKS) {
    errors.subtasks = t('A task can have at most {max} subtasks', { max: MAX_SUBTASKS });
  } else if (draft.subtasks.some((subtask) => subtask.title.trim().length > TITLE_MAX_LENGTH)) {
    errors.subtasks = t('Subtask titles must be {max} characters or fewer', {
      max: TITLE_MAX_LENGTH,
    });
  }

  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
