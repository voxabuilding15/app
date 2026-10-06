import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { useDebouncedValue, type Notice } from '@/hooks';
import { useTranslator } from '@/i18n';

import type { Task } from '../../domain/entities';
import {
  DEFAULT_FILTER,
  countActiveFilters,
  defaultSortFor,
  type TaskFilter,
  type TaskScope,
  type TaskSort,
} from '../../domain/filters';
import { useTasksModule } from '../module';
import { useInvalidateTasks, useTaskList, useTaskStats } from '../queries';

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;

export function useTaskListViewModel() {
  const { t, tn } = useTranslator();
  const { tasks: useCases } = useTasksModule();
  const invalidate = useInvalidateTasks();

  const [filterState, setFilter] = useState<TaskFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<TaskSort>(defaultSortFor('active'));
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  /** Ids soft-deleted in the current undo window; purged when the window closes. */
  const pendingDelete = useRef<readonly string[]>([]);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const filter = useMemo(() => ({ ...filterState, search }), [filterState, search]);

  const list = useTaskList(filter, sort, limit);
  const stats = useTaskStats();
  const tasks = useMemo<readonly Task[]>(() => list.data ?? [], [list.data]);

  const finalizeDelete = useCallback(async () => {
    const ids = pendingDelete.current;
    if (ids.length === 0) {
      return;
    }
    pendingDelete.current = [];
    await useCases.purge(ids);
  }, [useCases]);

  useEffect(
    () => () => {
      void finalizeDelete();
    },
    [finalizeDelete],
  );

  const changeSearch = useCallback((text: string) => {
    setSearchText(text);
    setLimit(PAGE_SIZE);
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setSelecting(false);
  }, []);

  useEffect(() => {
    if (!selecting) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => subscription.remove();
  }, [selecting, clearSelection]);

  const run = useCallback(
    async (action: () => Promise<void>, failureMessage: string) => {
      try {
        await action();
      } catch {
        setNotice({ message: failureMessage });
      }
      await invalidate();
    },
    [invalidate],
  );

  const dismissNotice = useCallback(() => {
    setNotice(null);
    void finalizeDelete();
  }, [finalizeDelete]);

  const setScope = useCallback(
    (scope: TaskScope) => {
      setFilter((current) => ({ ...current, scope }));
      setSort(defaultSortFor(scope));
      setLimit(PAGE_SIZE);
      clearSelection();
    },
    [clearSelection],
  );

  const updateFilter = useCallback((changes: Partial<Omit<TaskFilter, 'scope' | 'search'>>) => {
    setFilter((current) => ({ ...current, ...changes }));
    setLimit(PAGE_SIZE);
  }, []);

  const clearFilters = useCallback(() => {
    setFilter((current) => ({ ...DEFAULT_FILTER, scope: current.scope }));
    setSearchText('');
    setLimit(PAGE_SIZE);
  }, []);

  const changeSort = useCallback((next: TaskSort) => {
    setSort(next);
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

  const loadMore = useCallback(() => {
    if (!list.isFetching && tasks.length >= limit) {
      setLimit((current) => current + PAGE_SIZE);
    }
  }, [list.isFetching, tasks.length, limit]);

  const toggleComplete = useCallback(
    (task: Task) =>
      run(
        () => useCases.setCompleted(task.id, task.completedAt === null),
        t("Couldn't update the task"),
      ),
    [run, useCases, t],
  );

  const archive = useCallback(
    (ids: readonly string[]) =>
      run(async () => {
        await useCases.archive(ids);
        setNotice({ message: tn(ids.length, 'Task archived', '{count} tasks archived') });
      }, t("Couldn't archive")),
    [run, useCases, t, tn],
  );

  const restore = useCallback(
    (ids: readonly string[]) =>
      run(async () => {
        await useCases.restore(ids);
        setNotice({ message: tn(ids.length, 'Task restored', '{count} tasks restored') });
      }, t("Couldn't restore")),
    [run, useCases, t, tn],
  );

  const undoDelete = useCallback(async () => {
    const ids = pendingDelete.current;
    pendingDelete.current = [];
    setNotice(null);
    await run(() => useCases.undoRemove(ids), t("Couldn't undo the delete"));
  }, [run, useCases, t]);

  const remove = useCallback(
    (ids: readonly string[]) =>
      run(async () => {
        await finalizeDelete();
        await useCases.remove(ids);
        pendingDelete.current = ids;
        setNotice({
          message: tn(ids.length, 'Task deleted', '{count} tasks deleted'),
          actionLabel: t('Undo'),
          onAction: () => void undoDelete(),
        });
      }, t("Couldn't delete")),
    [run, useCases, finalizeDelete, undoDelete, t, tn],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setSelecting(false);
      }
      return next;
    });
  }, []);

  const startSelecting = useCallback((id?: string) => {
    setSelecting(true);
    if (id !== undefined) {
      setSelection(new Set([id]));
    }
  }, []);

  const selectAll = useCallback(() => {
    setSelection(new Set(tasks.map((task) => task.id)));
  }, [tasks]);

  const bulk = useCallback(
    async (action: (ids: readonly string[]) => Promise<void>) => {
      const ids = [...selection];
      clearSelection();
      await action(ids);
    },
    [selection, clearSelection],
  );

  return {
    filter,
    sort,
    searchText,
    searchOpen,
    activeFilterCount: countActiveFilters(filter),
    isFiltering: countActiveFilters(filter) > 0 || filter.search !== '',
    tasks,
    stats: stats.data,
    isLoading: list.isPending,
    isError: list.isError,
    isRefreshing: list.isRefetching,
    hasMore: tasks.length >= limit,
    notice,
    selecting,
    selection,
    setSearchText: changeSearch,
    toggleSearch,
    setScope,
    updateFilter,
    clearFilters,
    changeSort,
    loadMore,
    refetch: list.refetch,
    dismissNotice,
    toggleComplete,
    archive,
    restore,
    remove,
    startSelecting,
    toggleSelected,
    selectAll,
    clearSelection,
    archiveSelected: () => bulk(archive),
    restoreSelected: () => bulk(restore),
    removeSelected: () => bulk(remove),
  };
}

export type TaskListViewModel = ReturnType<typeof useTaskListViewModel>;
