import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { useDebouncedValue, useNotice, useUndoableDelete } from '@/hooks';

import type { NoteSummary } from '../../domain/entities';
import {
  DEFAULT_FILTER,
  DEFAULT_SORT,
  countActiveFilters,
  type NoteFilter,
  type NoteScope,
  type NoteSort,
} from '../../domain/filters';
import { useNotesModule } from '../module';
import { useFolders, useInvalidateNotes, useNotes, useTags } from '../queries';

const PAGE_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 250;

export function useNoteListViewModel() {
  const { notes: useCases } = useNotesModule();
  const invalidate = useInvalidateNotes();
  const { notice, show, dismiss } = useNotice();

  const [filterState, setFilter] = useState<NoteFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<NoteSort>(DEFAULT_SORT);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const filter = useMemo(() => ({ ...filterState, search }), [filterState, search]);

  const list = useNotes(filter, sort, limit);
  const folders = useFolders();
  const tags = useTags();
  const items = useMemo<readonly NoteSummary[]>(() => list.data ?? [], [list.data]);

  const run = useCallback(
    async (action: () => Promise<void>, failure: string) => {
      try {
        await action();
      } catch {
        show({ message: failure });
      }
      await invalidate();
    },
    [invalidate, show],
  );

  const setScope = useCallback((scope: NoteScope) => {
    setFilter((current) => ({ ...current, scope }));
    setLimit(PAGE_SIZE);
  }, []);

  const updateFilter = useCallback((changes: Partial<Omit<NoteFilter, 'scope' | 'search'>>) => {
    setFilter((current) => ({ ...current, ...changes }));
    setLimit(PAGE_SIZE);
  }, []);

  const clearFilters = useCallback(() => {
    setFilter((current) => ({ ...DEFAULT_FILTER, scope: current.scope }));
    setSearchText('');
    setLimit(PAGE_SIZE);
  }, []);

  const changeSort = useCallback((next: NoteSort) => {
    setSort(next);
    setLimit(PAGE_SIZE);
  }, []);

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

  const loadMore = useCallback(() => {
    if (!list.isFetching && items.length >= limit) {
      setLimit((current) => current + PAGE_SIZE);
    }
  }, [list.isFetching, items.length, limit]);

  const togglePinned = useCallback(
    (note: NoteSummary) =>
      run(() => useCases.setPinned(note.id, !note.pinned), "Couldn't update the note"),
    [run, useCases],
  );
  const toggleFavorite = useCallback(
    (note: NoteSummary) =>
      run(() => useCases.setFavorite(note.id, !note.favorite), "Couldn't update the note"),
    [run, useCases],
  );

  const trash = useUndoableDelete<string>({
    noun: 'Note',
    deletedMessage: 'Note moved to the trash',
    remove: async (id) => {
      await useCases.trash([id]);
      return id;
    },
    restore: (id) => useCases.restore([id]),
    onChanged: invalidate,
    show,
  });
  const archive = useUndoableDelete<string>({
    noun: 'Note',
    deletedMessage: 'Note archived',
    remove: async (id) => {
      await useCases.archive([id]);
      return id;
    },
    restore: (id) => useCases.unarchive([id]),
    onChanged: invalidate,
    show,
  });

  const unarchive = useCallback(
    (note: NoteSummary) =>
      run(async () => {
        await useCases.unarchive([note.id]);
        show({ message: 'Note restored to your notes' });
      }, "Couldn't restore the note"),
    [run, useCases, show],
  );
  const restore = useCallback(
    (note: NoteSummary) =>
      run(async () => {
        await useCases.restore([note.id]);
        show({ message: 'Note restored' });
      }, "Couldn't restore the note"),
    [run, useCases, show],
  );

  const deleteForever = useCallback(
    (note: NoteSummary) =>
      Alert.alert('Delete forever?', 'This note and its attachments cannot be recovered.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () =>
            void run(() => useCases.deleteForever([note.id]), "Couldn't delete the note"),
        },
      ]),
    [run, useCases],
  );

  const emptyTrash = useCallback(
    () =>
      Alert.alert('Empty the trash?', 'Every note in the trash is deleted for good.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty trash',
          style: 'destructive',
          onPress: () =>
            void run(async () => {
              const count = await useCases.emptyTrash();
              show({ message: count === 1 ? '1 note deleted' : `${count} notes deleted` });
            }, "Couldn't empty the trash"),
        },
      ]),
    [run, useCases, show],
  );

  return {
    filter,
    sort,
    searchText,
    searchOpen,
    activeFilterCount: countActiveFilters(filter),
    isFiltering: countActiveFilters(filter) > 0 || filter.search !== '',
    notes: items,
    folders: folders.data ?? [],
    tags: tags.data ?? [],
    isLoading: list.isPending,
    isError: list.isError,
    isRefreshing: list.isRefetching,
    notice,
    dismissNotice: dismiss,
    setScope,
    updateFilter,
    clearFilters,
    changeSort,
    setSearchText: changeSearch,
    toggleSearch,
    loadMore,
    refetch: list.refetch,
    togglePinned,
    toggleFavorite,
    trash,
    archive,
    unarchive,
    restore,
    deleteForever,
    emptyTrash,
  };
}

export type NoteListViewModel = ReturnType<typeof useNoteListViewModel>;
