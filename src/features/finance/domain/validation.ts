import { MAX_MINOR, MAX_RECURRENCE_INTERVAL, type DateKey, type RecurrenceRule } from '@/core';

import type { AccountType, BudgetPeriod, TransactionType } from './entities';

export const NOTE_MAX_LENGTH = 500;
export const NAME_MAX_LENGTH = 40;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string | null): value is DateKey {
  return value !== null && DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function amountError(amountMinor: number | null): string | undefined {
  if (amountMinor === null || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    return 'Enter an amount greater than zero';
  }
  return amountMinor > MAX_MINOR ? 'This amount is too large' : undefined;
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
  const errors: MovementErrors = {};
  const amount = amountError(fields.amountMinor);
  if (amount) {
    errors.amount = amount;
  }
  if (fields.accountId === null) {
    errors.account =
      fields.type === 'transfer' ? 'Choose the account to move money from' : 'Choose an account';
  }
  if (fields.type === 'transfer') {
    if (fields.toAccountId === null) {
      errors.toAccount = 'Choose the account to move money to';
    } else if (fields.toAccountId === fields.accountId) {
      errors.toAccount = 'Choose a different account';
    }
  }
  if (fields.note.length > NOTE_MAX_LENGTH) {
    errors.note = `Notes must be ${NOTE_MAX_LENGTH} characters or fewer`;
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
  const errors: TransactionErrors = validateMovement(draft);
  if (!Number.isFinite(draft.occurredAt)) {
    errors.date = 'Choose a date';
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
  const errors: AccountErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = 'Enter a name';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Use ${NAME_MAX_LENGTH} characters or fewer`;
  }
  if (
    draft.initialBalanceMinor === null ||
    !Number.isInteger(draft.initialBalanceMinor) ||
    Math.abs(draft.initialBalanceMinor) > MAX_MINOR
  ) {
    errors.balance = 'Enter a valid balance';
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
  const errors: BudgetErrors = {};
  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = 'Enter a name';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Use ${NAME_MAX_LENGTH} characters or fewer`;
  }
  const amount = amountError(draft.amountMinor);
  if (amount) {
    errors.amount = amount;
  }
  if (draft.period === 'custom') {
    if (!isDateKey(draft.startDate) || !isDateKey(draft.endDate)) {
      errors.dates = 'Choose when the budget starts and ends';
    } else if (draft.endDate < draft.startDate) {
      errors.dates = 'The end date cannot be before the start date';
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
  const errors: RecurringErrors = validateMovement(draft);
  const { rule } = draft;

  if (
    !Number.isInteger(rule.interval) ||
    rule.interval < 1 ||
    rule.interval > MAX_RECURRENCE_INTERVAL
  ) {
    errors.repeat = `Repeat every 1 to ${MAX_RECURRENCE_INTERVAL}`;
  } else if (!Number.isInteger(rule.weekdays) || rule.weekdays < 0 || rule.weekdays > 127) {
    errors.repeat = 'Choose valid weekdays';
  }
  if (!isDateKey(draft.startDate)) {
    errors.dates = 'Choose a start date';
  } else if (
    draft.endDate !== null &&
    (!isDateKey(draft.endDate) || draft.endDate < draft.startDate)
  ) {
    errors.dates = 'The end date cannot be before the start date';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}
