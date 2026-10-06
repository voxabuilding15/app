import { MAX_MINOR, MAX_RECURRENCE_INTERVAL, type DateKey, type RecurrenceRule } from '@/core';

import type { AccountType, BudgetPeriod, TransactionType } from './entities';
import { currentTranslator } from '@/i18n/translate';

export const NOTE_MAX_LENGTH = 500;
export const NAME_MAX_LENGTH = 40;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string | null): value is DateKey {
  return value !== null && DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function amountError(amountMinor: number | null): string | undefined {
  const { t } = currentTranslator();
  if (amountMinor === null || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    return t('Enter an amount greater than zero');
  }
  return amountMinor > MAX_MINOR ? t('This amount is too large') : undefined;
}

// --- Money movements (transactions and the recurring rules that post them) -----------------------

interface MovementFields {
  type: TransactionType;
  amountMinor: number | null;
  accountId: string | null;
  toAccountId: string | null;
  note: string;
}

interface MovementErrors {
  amount?: string;
  account?: string;
  toAccount?: string;
  note?: string;
}

function validateMovement(fields: MovementFields): MovementErrors {
  const { t } = currentTranslator();
  const errors: MovementErrors = {};
  const amount = amountError(fields.amountMinor);
  if (amount) {
    errors.amount = amount;
  }
  if (fields.accountId === null) {
    errors.account =
      fields.type === 'transfer'
        ? t('Choose the account to move money from')
        : t('Choose an account');
  }
  if (fields.type === 'transfer') {
    if (fields.toAccountId === null) {
      errors.toAccount = t('Choose the account to move money to');
    } else if (fields.toAccountId === fields.accountId) {
      errors.toAccount = t('Choose a different account');
    }
  }
  if (fields.note.length > NOTE_MAX_LENGTH) {
    errors.note = t('Notes must be {max} characters or fewer', { max: NOTE_MAX_LENGTH });
  }
  return errors;
}

export interface TransactionDraft {
  type: TransactionType;
  /** Null until a valid amount has been entered. */
  amountMinor: number | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  /** Epoch ms. */
  occurredAt: number;
}

export type TransactionErrors = MovementErrors & { date?: string };

export function validateTransaction(draft: TransactionDraft): TransactionErrors {
  const { t } = currentTranslator();
  const errors: TransactionErrors = validateMovement(draft);
  if (!Number.isFinite(draft.occurredAt)) {
    errors.date = t('Choose a date');
  }
  return errors;
}

// --- Accounts ---------------------------------------------------------------------------------------

export interface AccountDraft {
  name: string;
  type: AccountType;
  color: string;
  initialBalanceMinor: number | null;
}

export interface AccountErrors {
  name?: string;
  balance?: string;
}

export function validateAccount(draft: AccountDraft): AccountErrors {
  const { t } = currentTranslator();
  const errors: AccountErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = t('Enter a name');
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = t('Use {max} characters or fewer', { max: NAME_MAX_LENGTH });
  }
  if (
    draft.initialBalanceMinor === null ||
    !Number.isInteger(draft.initialBalanceMinor) ||
    Math.abs(draft.initialBalanceMinor) > MAX_MINOR
  ) {
    errors.balance = t('Enter a valid balance');
  }
  return errors;
}

// --- Budgets -----------------------------------------------------------------------------------------

export interface BudgetDraft {
  name: string;
  period: BudgetPeriod;
  amountMinor: number | null;
  startDate: DateKey | null;
  endDate: DateKey | null;
  categoryIds: string[];
}

export interface BudgetErrors {
  name?: string;
  amount?: string;
  dates?: string;
}

export function validateBudget(draft: BudgetDraft): BudgetErrors {
  const { t } = currentTranslator();
  const errors: BudgetErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = t('Enter a name');
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = t('Use {max} characters or fewer', { max: NAME_MAX_LENGTH });
  }
  const amount = amountError(draft.amountMinor);
  if (amount) {
    errors.amount = amount;
  }
  if (draft.period === 'custom') {
    if (!isDateKey(draft.startDate) || !isDateKey(draft.endDate)) {
      errors.dates = t('Choose when the budget starts and ends');
    } else if (draft.endDate < draft.startDate) {
      errors.dates = t('The end date cannot be before the start date');
    }
  }
  return errors;
}

// --- Recurring transactions ----------------------------------------------------------------------

export interface RecurringDraft {
  type: TransactionType;
  amountMinor: number | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  rule: RecurrenceRule;
  startDate: DateKey;
  endDate: DateKey | null;
}

export type RecurringErrors = MovementErrors & { repeat?: string; dates?: string };

export function validateRecurring(draft: RecurringDraft): RecurringErrors {
  const { t } = currentTranslator();
  const errors: RecurringErrors = validateMovement(draft);
  const { rule } = draft;

  if (
    !Number.isInteger(rule.interval) ||
    rule.interval < 1 ||
    rule.interval > MAX_RECURRENCE_INTERVAL
  ) {
    errors.repeat = t('Repeat every 1 to {max}', { max: MAX_RECURRENCE_INTERVAL });
  } else if (!Number.isInteger(rule.weekdays) || rule.weekdays < 0 || rule.weekdays > 127) {
    errors.repeat = t('Choose valid weekdays');
  }
  if (!isDateKey(draft.startDate)) {
    errors.dates = t('Choose a start date');
  } else if (
    draft.endDate !== null &&
    (!isDateKey(draft.endDate) || draft.endDate < draft.startDate)
  ) {
    errors.dates = t('The end date cannot be before the start date');
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
