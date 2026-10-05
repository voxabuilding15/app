import { useCallback, useMemo, useState } from 'react';

import { useDebouncedValue } from '@/hooks';

import type { Transaction } from '../../domain/entities';
import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  countActiveFilters,
  type TransactionFilter,
  type TransactionSort,
} from '../../domain/filters';
import { useFinanceModule } from '../module';
import {
  useAccounts,
  useFinanceCategories,
  useInvalidateFinance,
  useMonthFlow,
  useTransactions,
} from '../queries';

import { useNotice, useUndoableDelete } from './useUndoableDelete';

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;

interface TransactionListOptions {
  /** Starts the list filtered to one account, e.g. when opened from the accounts tab. */
  initialAccountId: string | null;
  /** Opens a transaction, used to offer "Edit" after duplicating one. */
  onOpen: (id: string) => void;
}

export function useTransactionListViewModel({ initialAccountId, onOpen }: TransactionListOptions) {
  const { transactions: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();

  const [filterState, setFilter] = useState<TransactionFilter>(() => ({
    ...DEFAULT_FILTER,
    accountId: initialAccountId,
  }));
  const [sort, setSort] = useState<TransactionSort>(DEFAULT_SORT);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const filter = useMemo(() => ({ ...filterState, search }), [filterState, search]);

  const list = useTransactions(filter, sort, limit);
  const flow = useMonthFlow();
  const accounts = useAccounts(true);
  const expenseCategories = useFinanceCategories('expense');
  const incomeCategories = useFinanceCategories('income');
  const items = useMemo<readonly Transaction[]>(() => list.data ?? [], [list.data]);

  const changeSearch = useCallback((text: string) => {
    setSearchText(text);
    setLimit(PAGE_SIZE);
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) {
        setSearchText('');
      }
      return !open;
    });
  }, []);

  const updateFilter = useCallback((changes: Partial<Omit<TransactionFilter, 'search'>>) => {
    setFilter((current) => ({ ...current, ...changes }));
    setLimit(PAGE_SIZE);
  }, []);

  const clearFilters = useCallback(() => {
    setFilter(DEFAULT_FILTER);
    setSearchText('');
    setLimit(PAGE_SIZE);
  }, []);

  const changeSort = useCallback((next: TransactionSort) => {
    setSort(next);
    setLimit(PAGE_SIZE);
  }, []);

  const loadMore = useCallback(() => {
    if (!list.isFetching && items.length >= limit) {
      setLimit((current) => current + PAGE_SIZE);
    }
  }, [list.isFetching, items.length, limit]);

  const remove = useUndoableDelete({
    noun: 'Transaction',
    remove: useCases.remove,
    restore: useCases.restore,
    onChanged: invalidate,
    show,
  });

  const duplicate = useCallback(
    async (item: Transaction) => {
      try {
        const id = await useCases.duplicate(item.id);
        show({
          message: 'Transaction duplicated',
          actionLabel: 'Edit',
          onAction: () => {
            show(null);
            onOpen(id);
          },
        });
      } catch {
        show({ message: "Couldn't duplicate the transaction" });
      }
      await invalidate();
    },
    [useCases, show, onOpen, invalidate],
  );

  return {
    filter,
    sort,
    searchText,
    searchOpen,
    activeFilterCount: countActiveFilters(filter),
    isFiltering: countActiveFilters(filter) > 0 || filter.search !== '',
    items,
    monthFlow: flow.data,
    accounts: accounts.data ?? [],
    hasAccounts: (accounts.data ?? []).some((account) => account.archivedAt === null),
    categories: [...(expenseCategories.data ?? []), ...(incomeCategories.data ?? [])],
    isLoading: list.isPending,
    isError: list.isError,
    isRefreshing: list.isRefetching,
    hasMore: items.length >= limit,
    notice,
    dismissNotice: dismiss,
    setSearchText: changeSearch,
    toggleSearch,
    updateFilter,
    clearFilters,
    changeSort,
    loadMore,
    refetch: list.refetch,
    remove,
    duplicate,
  };
}
