import { useCallback } from 'react';

import type { RecurringRecord, RecurringTransaction } from '../../domain/entities';
import { useFinanceModule } from '../module';
import { useInvalidateFinance, useRecurringList } from '../queries';

import { useNotice, useUndoableDelete } from '@/hooks';
import { useTranslator } from '@/i18n';

export function useRecurringViewModel() {
  const { t } = useTranslator();
  const { recurring: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();
  const query = useRecurringList();

  const remove = useUndoableDelete<RecurringRecord>({
    messages: {
      deleted: t('Recurring transaction deleted'),
      restoreFailed: t("Couldn't restore the recurring transaction"),
      deleteFailed: t("Couldn't delete the recurring transaction"),
    },
    remove: useCases.remove,
    restore: useCases.restore,
    onChanged: invalidate,
    show,
  });

  const setPaused = useCallback(
    async (item: RecurringTransaction, paused: boolean) => {
      try {
        await useCases.setPaused(item.id, paused);
        show({ message: paused ? t('Paused') : t('Resumed') });
      } catch {
        show({ message: t("Couldn't update the recurring transaction") });
      }
      await invalidate();
    },
    [useCases, show, invalidate, t],
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
