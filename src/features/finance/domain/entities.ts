import type { Category, DateKey, RecurrenceRule } from '@/core';

export type AccountType = 'cash' | 'bank' | 'savings' | 'credit_card';

export const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'savings', 'credit_card'];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  /** Balance before any recorded transaction. Negative for money owed, e.g. on a credit card. */
  initialBalanceMinor: number;
  archivedAt: number | null;
  createdAt: number;
}

export interface AccountBalance extends Account {
  /** Opening balance plus income, minus expenses, and transfers in minus transfers out. */
  balanceMinor: number;
  /** Transactions that touch the account (as source or destination). */
  transactionCount: number;
}

export interface AccountRef {
  id: string;
  name: string;
  color: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export const TRANSACTION_TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];

/** A transaction as listed, with the names needed to display it. */
export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  account: AccountRef;
  /** Where a transfer goes; null for income and expenses. */
  toAccount: AccountRef | null;
  category: Category | null;
  note: string;
  occurredAt: number;
  /** Set when a recurring rule posted this transaction. */
  recurringId: string | null;
}

/** A transaction as stored. */
export interface TransactionRecord {
  id: string;
  type: TransactionType;
  amountMinor: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  occurredAt: number;
  recurringId: string | null;
  /** The schedule day a recurring rule posted this for; stops it being posted twice. */
  occurrenceDate: DateKey | null;
  createdAt: number;
  updatedAt: number;
}

export type BudgetPeriod = 'weekly' | 'monthly' | 'custom';

export const BUDGET_PERIODS: readonly BudgetPeriod[] = ['monthly', 'weekly', 'custom'];

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  amountMinor: number;
  /** First and last day (inclusive) of a custom budget; null for weekly and monthly ones. */
  startDate: DateKey | null;
  endDate: DateKey | null;
  /** Expense categories it limits; empty means all spending. */
  categoryIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type BudgetState = 'ok' | 'warning' | 'over';
/** Whether the budget's period is current, hasn't started, or is over. */
export type BudgetPhase = 'active' | 'upcoming' | 'ended';

export interface BudgetProgress {
  budget: Budget;
  categories: Category[];
  from: DateKey;
  to: DateKey;
  spentMinor: number;
  /** Negative once the budget is exceeded. */
  remainingMinor: number;
  /** spent / amount; may exceed 1. */
  fraction: number;
  state: BudgetState;
  phase: BudgetPhase;
}

/** A rule that posts a transaction on a schedule. */
export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  account: AccountRef;
  toAccount: AccountRef | null;
  category: Category | null;
  note: string;
  rule: RecurrenceRule;
  startDate: DateKey;
  endDate: DateKey | null;
  /** The next day it will post; null once the series is finished. */
  nextDate: DateKey | null;
  paused: boolean;
}

export interface RecurringRecord {
  id: string;
  type: TransactionType;
  amountMinor: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  note: string;
  rule: RecurrenceRule;
  startDate: DateKey;
  endDate: DateKey | null;
  nextDate: DateKey | null;
  paused: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FlowTotals {
  incomeMinor: number;
  expenseMinor: number;
}

/** Spending (or income) in one category over a period. `id` is null for uncategorized. */
export interface CategoryTotal {
  id: string | null;
  name: string;
  color: string;
  totalMinor: number;
}
