import { useBudgets, useInvalidateFinance } from '../queries';
import { useFinanceModule } from '../module';
import type { Budget } from '../../domain/entities';

import { useNotice, useUndoableDelete } from './useUndoableDelete';

export function useBudgetsViewModel() {
  const { budgets: useCases } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const { notice, show, dismiss } = useNotice();
  const query = useBudgets();

  const remove = useUndoableDelete<Budget>({
    noun: 'Budget',
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
