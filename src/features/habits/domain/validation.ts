import { ALL_WEEKDAYS } from './schedule';
import type { HabitPeriod } from './entities';
import { currentTranslator } from '@/i18n/translate';

export const HABIT_NAME_MAX_LENGTH = 60;
export const HABIT_NOTES_MAX_LENGTH = 2_000;
export const MAX_GOAL = 99;
export const MAX_DAY_COUNT = 999;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface HabitDraft {
  name: string;
  notes: string;
  icon: string;
  color: string;
  categoryId: string | null;
  period: HabitPeriod;
  weekdays: number;
  goalCount: number;
  /** HH:MM, or null for no reminder. */
  reminderTime: string | null;
}

export type HabitDraftField = 'name' | 'notes' | 'goal' | 'weekdays' | 'reminder';
export type HabitDraftErrors = Partial<Record<HabitDraftField, string>>;

export function emptyHabitDraft(icon: string, color: string): HabitDraft {
  return {
    name: '',
    notes: '',
    icon,
    color,
    categoryId: null,
    period: 'daily',
    weekdays: ALL_WEEKDAYS,
    goalCount: 1,
    reminderTime: null,
  };
}

export function validateHabitDraft(draft: HabitDraft): HabitDraftErrors {
  const { t } = currentTranslator();
  const errors: HabitDraftErrors = {};
  const name = draft.name.trim();

  if (name.length === 0) {
    errors.name = t('Enter a name');
  } else if (name.length > HABIT_NAME_MAX_LENGTH) {
    errors.name = t('Name must be {max} characters or fewer', { max: HABIT_NAME_MAX_LENGTH });
  }
  if (draft.notes.length > HABIT_NOTES_MAX_LENGTH) {
    errors.notes = t('Notes must be {max} characters or fewer', { max: HABIT_NOTES_MAX_LENGTH });
  }
  if (!Number.isInteger(draft.goalCount) || draft.goalCount < 1 || draft.goalCount > MAX_GOAL) {
    errors.goal = t('Goal must be between 1 and {max}', { max: MAX_GOAL });
  }
  if (draft.period === 'daily' && (draft.weekdays < 1 || draft.weekdays > ALL_WEEKDAYS)) {
    errors.weekdays = t('Choose at least one day');
  }
  if (draft.reminderTime !== null && !TIME_PATTERN.test(draft.reminderTime)) {
    errors.reminder = t('Choose a valid reminder time');
  }
  return errors;
}

export function hasHabitErrors(errors: HabitDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
