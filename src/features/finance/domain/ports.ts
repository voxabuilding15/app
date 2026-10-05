import type { DateKey } from '@/core';

import type {
  Account,
  AccountBalance,
  Budget,
  CategoryTotal,
  FlowTotals,
  RecurringRecord,
  RecurringTransaction,
  Transaction,
  TransactionRecord,
  TransactionType,
} from './entities';
import type { TimeRange, TransactionFilter, TransactionSort } from './filters';

export interface AccountRepository {
  list(includeArchived: boolean): Promise<AccountBalance[]>;
  get(id: string): Promise<Account | null>;
  insert(account: Account): Promise<void>;
  update(account: Account): Promise<void>;
  setArchivedAt(id: string, archivedAt: number | null): Promise<void>;
  /** Transactions and recurring rules that refer to the account. */
  usageCount(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}

export interface TransactionListContext {
  now: number;
  limit: number;
}

export interface TransactionRepository {
  list(
    filter: TransactionFilter,
    sort: TransactionSort,
    context: TransactionListContext,
  ): Promise<Transaction[]>;
  get(id: string): Promise<TransactionRecord | null>;
  insert(record: TransactionRecord): Promise<void>;
  update(record: TransactionRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Income and expense totals in a period; transfers move money but are neither. */
  flow(range: TimeRange): Promise<FlowTotals>;
  /** Totals per category for one transaction type in a period, largest first. */
  categoryTotals(
    type: Extract<TransactionType, 'income' | 'expense'>,
    range: TimeRange,
  ): Promise<CategoryTotal[]>;
  /** Total spent in a period, limited to `categoryIds` unless that is empty. */
  expenseTotal(range: TimeRange, categoryIds: readonly string[]): Promise<number>;
}

export interface BudgetRepository {
  list(): Promise<Budget[]>;
  get(id: string): Promise<Budget | null>;
  insert(budget: Budget): Promise<void>;
  update(budget: Budget): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RecurringRepository {
  list(): Promise<RecurringTransaction[]>;
  get(id: string): Promise<RecurringRecord | null>;
  insert(record: RecurringRecord): Promise<void>;
  update(record: RecurringRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** Active rules whose next posting day is on or before `today`. */
  listDue(today: DateKey): Promise<RecurringRecord[]>;
  /**
   * Atomically stores the transactions a rule posted and moves its cursor on. Transactions for an
   * occurrence that was already posted are ignored.
   */
  postOccurrences(
    id: string,
    transactions: readonly TransactionRecord[],
    nextDate: DateKey | null,
    updatedAt: number,
  ): Promise<void>;
}
