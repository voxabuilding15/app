import { useCallback } from 'react';

import { useFinanceModule } from '../module';
import { useInvalidateFinance } from '../queries';

export type CreatedCategory = { id: string } | { error: string };

/** Creates an income or expense category from inside a form and refreshes the category lists. */
export function useCategoryCreator(kind: 'expense' | 'income') {
  const { expenseCategories, incomeCategories } = useFinanceModule();
  const invalidate = useInvalidateFinance();
  const useCases = kind === 'income' ? incomeCategories : expenseCategories;

  return useCallback(
    async (name: string, color: string): Promise<CreatedCategory> => {
      try {
        const result = await useCases.save({ id: null, name, color });
        if (!result.ok) {
          return { error: result.error };
        }
        await invalidate();
        return { id: result.id };
      } catch {
        return { error: "Couldn't save. Please try again." };
      }
    },
    [useCases, invalidate],
  );
}
