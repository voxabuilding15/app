import type { DueDate, Priority, RepeatRule } from './entities';
import { MAX_REPEAT_INTERVAL } from './repeat';
import { isValidReminderOffset } from './reminder';

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
  const errors: DraftErrors = {};

  if (draft.title.trim().length === 0) {
    errors.title = 'Enter a title';
  } else if (draft.title.trim().length > TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer`;
  }

  if (draft.notes.length > NOTES_MAX_LENGTH) {
    errors.notes = `Notes must be ${NOTES_MAX_LENGTH} characters or fewer`;
  }

  if (draft.reminderOffsetMinutes !== null) {
    if (draft.due === null) {
      errors.reminder = 'Set a due date to use a reminder';
    } else if (!isValidReminderOffset(draft.reminderOffsetMinutes, draft.due.hasTime)) {
      errors.reminder = 'Choose a valid reminder time';
    }
  }

  if (draft.repeat !== null) {
    if (draft.due === null) {
      errors.repeat = 'Set a due date to repeat this task';
    } else if (
      !Number.isInteger(draft.repeat.interval) ||
      draft.repeat.interval < 1 ||
      draft.repeat.interval > MAX_REPEAT_INTERVAL
    ) {
      errors.repeat = `Repeat interval must be between 1 and ${MAX_REPEAT_INTERVAL}`;
    }
  }

  if (draft.subtasks.length > MAX_SUBTASKS) {
    errors.subtasks = `A task can have at most ${MAX_SUBTASKS} subtasks`;
  } else if (draft.subtasks.some((subtask) => subtask.title.trim().length > TITLE_MAX_LENGTH)) {
    errors.subtasks = `Subtask titles must be ${TITLE_MAX_LENGTH} characters or fewer`;
  }

  return errors;
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
