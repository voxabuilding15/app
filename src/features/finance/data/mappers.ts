import type { Category, DateKey } from '@/core';

import type {
  Account,
  AccountBalance,
  AccountRef,
  AccountType,
  Budget,
  BudgetPeriod,
  RecurringRecord,
  RecurringTransaction,
  Transaction,
  TransactionRecord,
  TransactionType,
} from '../domain/entities';

export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initial_balance_minor: number;
  archived_at: number | null;
  created_at: number;
}

export interface AccountBalanceRow extends AccountRow {
  balance_minor: number;
  transaction_count: number;
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    initialBalanceMinor: row.initial_balance_minor,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export function toAccountBalance(row: AccountBalanceRow): AccountBalance {
  return {
    ...toAccount(row),
    balanceMinor: row.balance_minor,
    transactionCount: row.transaction_count,
  };
}

/** Joined account and category columns shared by transaction and recurring-rule listings. */
interface JoinedRefs {
  account_id: string;
  account_name: string;
  account_color: string;
  to_id: string | null;
  to_name: string | null;
  to_color: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
}

export const SELECT_REFS = `
  a.id AS account_id, a.name AS account_name, a.color AS account_color,
  d.id AS to_id, d.name AS to_name, d.color AS to_color,
  c.id AS category_id, c.name AS category_name, c.color AS category_color`;

export const JOIN_REFS = `
  JOIN accounts a ON a.id = t.account_id
  LEFT JOIN accounts d ON d.id = t.to_account_id
  LEFT JOIN categories c ON c.id = t.category_id`;

function refs(row: JoinedRefs): {
  account: AccountRef;
  toAccount: AccountRef | null;
  category: Category | null;
} {
  return {
    account: { id: row.account_id, name: row.account_name, color: row.account_color },
    toAccount:
      row.to_id === null
        ? null
        : { id: row.to_id, name: row.to_name ?? '', color: row.to_color ?? '' },
    category:
      row.category_id === null
        ? null
        : { id: row.category_id, name: row.category_name ?? '', color: row.category_color ?? '' },
  };
}

export interface TransactionRow extends JoinedRefs {
  id: string;
  type: TransactionType;
  amount_minor: number;
  note: string;
  occurred_at: number;
  recurring_id: string | null;
}

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    note: row.note,
    occurredAt: row.occurred_at,
    recurringId: row.recurring_id,
    ...refs(row),
  };
}

export interface TransactionRecordRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string;
  occurred_at: number;
  recurring_id: string | null;
  occurrence_date: string | null;
  created_at: number;
  updated_at: number;
}

export function toTransactionRecord(row: TransactionRecordRow): TransactionRecord {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    note: row.note,
    occurredAt: row.occurred_at,
    recurringId: row.recurring_id,
    occurrenceDate: row.occurrence_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface BudgetRow {
  id: string;
  name: string;
  period: BudgetPeriod;
  amount_minor: number;
  start_date: string | null;
  end_date: string | null;
  created_at: number;
  updated_at: number;
}

export function toBudget(row: BudgetRow, categoryIds: string[]): Budget {
  return {
    id: row.id,
    name: row.name,
    period: row.period,
    amountMinor: row.amount_minor,
    startDate: row.start_date,
    endDate: row.end_date,
    categoryIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RecurringRecordRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  note: string;
  repeat_unit: RecurringRecord['rule']['unit'];
  repeat_interval: number;
  repeat_weekdays: number;
  start_date: DateKey;
  end_date: DateKey | null;
  next_date: DateKey | null;
  paused: number;
  created_at: number;
  updated_at: number;
}

export function toRecurringRecord(row: RecurringRecordRow): RecurringRecord {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    note: row.note,
    rule: { unit: row.repeat_unit, interval: row.repeat_interval, weekdays: row.repeat_weekdays },
    startDate: row.start_date,
    endDate: row.end_date,
    nextDate: row.next_date,
    paused: row.paused === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface RecurringRow extends JoinedRefs {
  id: string;
  type: TransactionType;
  amount_minor: number;
  note: string;
  repeat_unit: RecurringRecord['rule']['unit'];
  repeat_interval: number;
  repeat_weekdays: number;
  start_date: DateKey;
  end_date: DateKey | null;
  next_date: DateKey | null;
  paused: number;
}

export function toRecurring(row: RecurringRow): RecurringTransaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    note: row.note,
    rule: { unit: row.repeat_unit, interval: row.repeat_interval, weekdays: row.repeat_weekdays },
    startDate: row.start_date,
    endDate: row.end_date,
    nextDate: row.next_date,
    paused: row.paused === 1,
    ...refs(row),
  };
}
