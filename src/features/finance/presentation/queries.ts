import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category } from '@/core';

import type {
  AccountBalance,
  Budget,
  BudgetProgress,
  FlowTotals,
  RecurringRecord,
  RecurringTransaction,
  Transaction,
  TransactionRecord,
} from '../domain/entities';
import type { TransactionFilter, TransactionSort } from '../domain/filters';
import type { Breakdown, FinanceStats, StatsMonths } from '../domain/stats-usecases';

import { useFinanceModule } from './module';

const ROOT = ['finance'] as const;

const keys = {
  currency: [...ROOT, 'currency'] as const,
  transactions: (filter: TransactionFilter, sort: TransactionSort, limit: number) =>
    [...ROOT, 'transactions', filter, sort, limit] as const,
  transaction: (id: string) => [...ROOT, 'transaction', id] as const,
  monthFlow: [...ROOT, 'month-flow'] as const,
  accounts: (includeArchived: boolean) => [...ROOT, 'accounts', includeArchived] as const,
  budgets: [...ROOT, 'budgets'] as const,
  budget: (id: string) => [...ROOT, 'budget', id] as const,
  recurringList: [...ROOT, 'recurring'] as const,
  recurring: (id: string) => [...ROOT, 'recurring-rule', id] as const,
  stats: (months: StatsMonths, breakdown: Breakdown) =>
    [...ROOT, 'stats', months, breakdown] as const,
  categories: (kind: 'expense' | 'income') => [...ROOT, 'categories', kind] as const,
};

/** The currency amounts are shown in. It is read from storage, so it is available immediately. */
export function useCurrency(): string {
  const { settings } = useFinanceModule();
  const { data } = useQuery({
    queryKey: keys.currency,
    queryFn: () => settings.currency(),
    initialData: () => settings.currency(),
  });
  return data;
}

export function useTransactions(
  filter: TransactionFilter,
  sort: TransactionSort,
  limit: number,
): UseQueryResult<Transaction[]> {
  const { transactions } = useFinanceModule();
  return useQuery({
    queryKey: keys.transactions(filter, sort, limit),
    queryFn: () => transactions.list(filter, sort, limit),
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(id: string | null): UseQueryResult<TransactionRecord | null> {
  const { transactions } = useFinanceModule();
  return useQuery({
    queryKey: keys.transaction(id ?? ''),
    queryFn: () => (id === null ? null : transactions.get(id)),
    enabled: id !== null,
    // The form owns its own editable copy; never replace it while the user is typing.
    gcTime: 0,
  });
}

export function useMonthFlow(): UseQueryResult<FlowTotals> {
  const { transactions } = useFinanceModule();
  return useQuery({ queryKey: keys.monthFlow, queryFn: () => transactions.monthFlow() });
}

export function useAccounts(includeArchived: boolean): UseQueryResult<AccountBalance[]> {
  const { accounts } = useFinanceModule();
  return useQuery({
    queryKey: keys.accounts(includeArchived),
    queryFn: () => accounts.list(includeArchived),
  });
}

export function useBudgets(): UseQueryResult<BudgetProgress[]> {
  const { budgets } = useFinanceModule();
  return useQuery({ queryKey: keys.budgets, queryFn: () => budgets.list() });
}

export function useBudget(id: string | null): UseQueryResult<Budget | null> {
  const { budgets } = useFinanceModule();
  return useQuery({
    queryKey: keys.budget(id ?? ''),
    queryFn: () => (id === null ? null : budgets.get(id)),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useRecurringList(): UseQueryResult<RecurringTransaction[]> {
  const { recurring } = useFinanceModule();
  return useQuery({ queryKey: keys.recurringList, queryFn: () => recurring.list() });
}

export function useRecurring(id: string | null): UseQueryResult<RecurringRecord | null> {
  const { recurring } = useFinanceModule();
  return useQuery({
    queryKey: keys.recurring(id ?? ''),
    queryFn: () => (id === null ? null : recurring.get(id)),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useFinanceStats(
  months: StatsMonths,
  breakdown: Breakdown,
): UseQueryResult<FinanceStats> {
  const { stats } = useFinanceModule();
  return useQuery({
    queryKey: keys.stats(months, breakdown),
    queryFn: () => stats.overview(months, breakdown),
    placeholderData: keepPreviousData,
  });
}

export function useFinanceCategories(kind: 'expense' | 'income'): UseQueryResult<Category[]> {
  const { expenseCategories, incomeCategories } = useFinanceModule();
  const useCases = kind === 'expense' ? expenseCategories : incomeCategories;
  return useQuery({ queryKey: keys.categories(kind), queryFn: () => useCases.list() });
}

/** Refreshes every Finance query after a write. */
export function useInvalidateFinance(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}
