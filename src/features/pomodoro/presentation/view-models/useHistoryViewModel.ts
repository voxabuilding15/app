import { useCallback, useMemo, useState } from 'react';

import { useDebouncedValue, useNotice, useUndoableDelete } from '@/hooks';

import type { HistoryScope } from '../../domain/entities';
import { useHistory, useInvalidatePomodoro } from '../queries';
import { usePomodoroModule } from '../module';

const SEARCH_DELAY_MS = 250;

export function useHistoryViewModel() {
  const { sessions } = usePomodoroModule();
  const invalidate = useInvalidatePomodoro();
  const { notice, show, dismiss } = useNotice();
  const [scope, setScope] = useState<HistoryScope>('focus');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, SEARCH_DELAY_MS);
  const query = useMemo(() => ({ scope, search: debounced }), [scope, debounced]);
  const history = useHistory(query);

  const remove = useCallback(
    async (id: string) => {
      const removed = await sessions.remove(id);
      if (removed === null) {
        throw new Error('The session no longer exists');
      }
      return removed;
    },
    [sessions],
  );

  const deleteSession = useUndoableDelete({
    noun: 'Session',
    remove,
    restore: sessions.restore,
    onChanged: invalidate,
    show,
  });

  return {
    scope,
    setScope,
    search,
    setSearch,
    isSearching: debounced !== '',
    sessions: history.data ?? [],
    isLoading: history.isPending,
    isError: history.isError,
    refetch: history.refetch,
    deleteSession,
    notice,
    dismissNotice: dismiss,
  };
}

export type HistoryViewModel = ReturnType<typeof useHistoryViewModel>;
