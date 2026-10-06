import { useBudgets, useInvalidateFinance } from '../queries';
import { useFinanceModule } from '../module';
import type { Budget } from '../../domain/entities';

import { useNotice, useUndoableDelete } from '@/hooks';
import { useTranslator } from '@/i18n';

export function useBudgetsViewModel() {
  const { t } = useTranslator();
  const { budgets: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();
  const query = useBudgets();

  const remove = useUndoableDelete<Budget>({
    messages: {
      deleted: t('Budget deleted'),
      restoreFailed: t("Couldn't restore the budget"),
      deleteFailed: t("Couldn't delete the budget"),
    },
    remove: useCases.remove,
    restore: useCases.restore,
    onChanged: invalidate,
    show,
  });

  const items = query.data ?? [];
  return {
    budgets: items,
    overCount: items.filter((item) => item.phase === 'active' && item.state === 'over').length,
    isLoading: query.isPending,
    isError: query.isError,
    isRefreshing: query.isRefetching,
    refetch: query.refetch,
    notice,
    dismissNotice: dismiss,
    remove,
  };
}
