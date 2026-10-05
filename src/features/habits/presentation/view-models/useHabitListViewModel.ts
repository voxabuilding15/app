import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { toDateKey } from '@/core';
import { useDebouncedValue, useNow, useOnAppForeground } from '@/hooks';

import {
  DEFAULT_HABIT_FILTER,
  DEFAULT_HABIT_SORT,
  countActiveHabitFilters,
  filterHabits,
  sortHabits,
  todayOverview,
  type HabitFilter,
  type HabitScope,
  type HabitSort,
} from '../../domain/filters';
import type { HabitSummary } from '../../domain/progress';
import { useHabitsModule } from '../module';
import { useHabitCategories, useHabitList, useInvalidateHabits } from '../queries';

const SEARCH_DEBOUNCE_MS = 250;
const NO_SUMMARIES: readonly HabitSummary[] = [];

type FilterSelection = Omit<HabitFilter, 'search'>;
const DEFAULT_SELECTION: FilterSelection = {
  period: DEFAULT_HABIT_FILTER.period,
  categoryId: DEFAULT_HABIT_FILTER.categoryId,
  status: DEFAULT_HABIT_FILTER.status,
};

export function useHabitListViewModel() {
  const { habits } = useHabitsModule();
  const invalidate = useInvalidateHabits();
  const now = useNow();
  const today = toDateKey(now);

  const [scope, setScopeState] = useState<HabitScope>('active');
  const [selection, setSelection] = useState<FilterSelection>(DEFAULT_SELECTION);
  const [sort, setSort] = useState<HabitSort>(DEFAULT_HABIT_SORT);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const filter = useMemo<HabitFilter>(() => ({ ...selection, search }), [selection, search]);

  const list = useHabitList(scope);
  const categories = useHabitCategories();
  const summaries = list.data ?? NO_SUMMARIES;

  const visible = useMemo(
    () => sortHabits(filterHabits(summaries, filter), sort),
    [summaries, filter, sort],
  );
  const overview = useMemo(
    () => (scope === 'active' ? todayOverview(summaries) : null),
    [scope, summaries],
  );

  // Progress is relative to "today", so refresh when the day rolls over or the app returns.
  const lastDay = useRef(today);
  useEffect(() => {
    if (lastDay.current !== today) {
      lastDay.current = today;
      void invalidate();
    }
  }, [today, invalidate]);
  useOnAppForeground(() => void invalidate());

  const run = useCallback(
    async (action: () => Promise<unknown>, failureMessage: string) => {
      try {
        await action();
      } catch {
        setNotice(failureMessage);
      }
      await invalidate();
    },
    [invalidate],
  );

  const setScope = useCallback((next: HabitScope) => {
    setScopeState(next);
    setSelection(DEFAULT_SELECTION);
    setSort(DEFAULT_HABIT_SORT);
    setSearchText('');
  }, []);

  const clearFilters = useCallback(() => {
    setSelection(DEFAULT_SELECTION);
    setSearchText('');
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) {
        setSearchText('');
      }
      return !open;
    });
  }, []);

  const adjust = useCallback(
    (summary: HabitSummary, delta: number) =>
      run(() => habits.adjust(summary.habit.id, today, delta), "Couldn't update the habit"),
    [run, habits, today],
  );

  const toggleToday = useCallback(
    (summary: HabitSummary) =>
      run(
        () => habits.setCount(summary.habit.id, today, summary.todayCount > 0 ? 0 : 1),
        "Couldn't update the habit",
      ),
    [run, habits, today],
  );

  const skipToday = useCallback(
    (summary: HabitSummary) =>
      run(
        () => habits.skip(summary.habit.id, today, !summary.skippedToday),
        "Couldn't update the habit",
      ),
    [run, habits, today],
  );

  const archive = useCallback(
    (summary: HabitSummary) =>
      run(async () => {
        await habits.archive(summary.habit.id);
        setNotice(`${summary.habit.name} archived`);
      }, "Couldn't archive the habit"),
    [run, habits],
  );

  const restore = useCallback(
    (summary: HabitSummary) =>
      run(async () => {
        await habits.restore(summary.habit.id);
        setNotice(`${summary.habit.name} restored`);
      }, "Couldn't restore the habit"),
    [run, habits],
  );

  const confirmDelete = useCallback(
    (summary: HabitSummary) => {
      Alert.alert(
        `Delete "${summary.habit.name}"?`,
        'This permanently deletes the habit and its whole history. Archive it instead to keep the history.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void run(() => habits.remove(summary.habit.id), "Couldn't delete the habit"),
          },
        ],
      );
    },
    [run, habits],
  );

  return {
    scope,
    sort,
    selection,
    searchText,
    searchOpen,
    activeFilterCount: countActiveHabitFilters(filter),
    isFiltering: countActiveHabitFilters(filter) > 0 || filter.search !== '',
    habits: visible,
    categories: categories.data ?? [],
    overview,
    isLoading: list.isPending,
    isError: list.isError,
    isRefreshing: list.isRefetching,
    notice,
    setScope,
    setSelection: (changes: Partial<FilterSelection>) =>
      setSelection((current) => ({ ...current, ...changes })),
    setSort,
    setSearchText,
    toggleSearch,
    clearFilters,
    refetch: list.refetch,
    dismissNotice: useCallback(() => setNotice(null), []),
    adjust,
    toggleToday,
    skipToday,
    archive,
    restore,
    confirmDelete,
  };
}

export type HabitListViewModel = ReturnType<typeof useHabitListViewModel>;
