import { useCallback } from 'react';

import type { RecurringRecord, RecurringTransaction } from '../../domain/entities';
import { useFinanceModule } from '../module';
import { useInvalidateFinance, useRecurringList } from '../queries';

import { useNotice, useUndoableDelete } from '@/hooks';

export function useRecurringViewModel() {
  const { recurring: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();
  const query = useRecurringList();

  const remove = useUndoableDelete<RecurringRecord>({
    noun: 'Recurring transaction',
    remove: useCases.remove,
    restore: useCases.restore,
    onChanged: invalidate,
    show,
  });

  const setPaused = useCallback(
    async (item: RecurringTransaction, paused: boolean) => {
      try {
        await useCases.setPaused(item.id, paused);
        show({ message: paused ? 'Paused' : 'Resumed' });
      } catch {
        show({ message: "Couldn't update the recurring transaction" });
      }
      await invalidate();
    },
    [useCases, show, invalidate],
  );

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    isRefreshing: query.isRefetching,
    refetch: query.refetch,
    notice,
    dismissNotice: dismiss,
    remove,
    setPaused,
  };
}
