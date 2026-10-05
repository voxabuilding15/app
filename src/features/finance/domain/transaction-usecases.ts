import { createId, type Clock } from '@/core';

import { checkAccounts } from './account-checks';
import type { OverBudget } from './budget-usecases';
import type { FlowTotals, Transaction, TransactionRecord } from './entities';
import { presetRange, type TransactionFilter, type TransactionSort } from './filters';
import type { AccountRepository, TransactionRepository } from './ports';
import {
  hasErrors,
  validateTransaction,
  type TransactionDraft,
  type TransactionErrors,
} from './validation';

export type SaveTransactionResult =
  { ok: true; id: string; overBudgets: OverBudget[] } | { ok: false; errors: TransactionErrors };

interface TransactionUseCaseDeps {
  transactions: TransactionRepository;
  accounts: AccountRepository;
  /** Reports budgets an expense has pushed over their limit. */
  overspentBy: (categoryId: string | null, occurredAt: number) => Promise<OverBudget[]>;
  clock: Clock;
}

export function createTransactionUseCases({
  transactions,
  accounts,
  overspentBy,
  clock,
}: TransactionUseCaseDeps) {
  return {
    list(filter: TransactionFilter, sort: TransactionSort, limit: number): Promise<Transaction[]> {
      return transactions.list(filter, sort, { now: clock.now(), limit });
    },

    get(id: string): Promise<TransactionRecord | null> {
      return transactions.get(id);
    },

    /** Income and expenses so far this month. */
    monthFlow(): Promise<FlowTotals> {
      const range = presetRange('month', clock.now());
      return range === null
        ? Promise.resolve({ incomeMinor: 0, expenseMinor: 0 })
        : transactions.flow(range);
    },

    async save(draft: TransactionDraft, id: string | null): Promise<SaveTransactionResult> {
      const errors = validateTransaction(draft);
      const existing = id === null ? null : await transactions.get(id);
      if (id !== null && existing === null) {
        throw new Error('This transaction no longer exists.');
      }

      Object.assign(errors, await checkAccounts(accounts, draft, existing));
      if (hasErrors(errors) || draft.amountMinor === null || draft.accountId === null) {
        return { ok: false, errors };
      }

      const now = clock.now();
      const transfer = draft.type === 'transfer';
      const record: TransactionRecord = {
        id: existing?.id ?? createId(),
        type: draft.type,
        amountMinor: draft.amountMinor,
        accountId: draft.accountId,
        toAccountId: transfer ? draft.toAccountId : null,
        categoryId: transfer ? null : draft.categoryId,
        note: draft.note.trim(),
        occurredAt: draft.occurredAt,
        recurringId: existing?.recurringId ?? null,
        occurrenceDate: existing?.occurrenceDate ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing === null) {
        await transactions.insert(record);
      } else {
        await transactions.update(record);
      }

      const overBudgets =
        record.type === 'expense' ? await overspentBy(record.categoryId, record.occurredAt) : [];
      return { ok: true, id: record.id, overBudgets };
    },

    /** Copies a transaction as a new one dated now, e.g. for something bought again. */
    async duplicate(id: string): Promise<string> {
      const record = await transactions.get(id);
      if (record === null) {
        throw new Error('This transaction no longer exists.');
      }
      const problems = await checkAccounts(accounts, record, null);
      if (problems.account || problems.toAccount) {
        throw new Error(problems.account ?? problems.toAccount);
      }
      const now = clock.now();
      const copy: TransactionRecord = {
        ...record,
        id: createId(),
        occurredAt: now,
        recurringId: null,
        occurrenceDate: null,
        createdAt: now,
        updatedAt: now,
      };
      await transactions.insert(copy);
      return copy.id;
    },

    /** Deletes a transaction and returns it so the deletion can be undone. */
    async remove(id: string): Promise<TransactionRecord> {
      const record = await transactions.get(id);
      if (record === null) {
        throw new Error('This transaction no longer exists.');
      }
      await transactions.delete(id);
      return record;
    },

    restore(record: TransactionRecord): Promise<void> {
      return transactions.insert(record);
    },
  };
}

export type TransactionUseCases = ReturnType<typeof createTransactionUseCases>;
