import { useState } from 'react';

import { useNamedItemEditor } from '@/hooks';

import { useFinanceModule } from '../module';
import { useFinanceCategories, useInvalidateFinance } from '../queries';

export type CategoryTab = 'expense' | 'income';

/** Both category lists, with the editor wired to whichever one is showing. */
export function useFinanceCategoriesViewModel() {
  const { expenseCategories, incomeCategories } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const [tab, setTab] = useState<CategoryTab>('expense');
  const useCases = tab === 'expense' ? expenseCategories : incomeCategories;

  const query = useFinanceCategories(tab);
  const editor = useNamedItemEditor({
    noun: 'category',
    save: useCases.save,
    remove: useCases.delete,
    onChanged: invalidate,
  });

  return {
    tab,
    setTab,
    items: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    ...editor,
  };
}
