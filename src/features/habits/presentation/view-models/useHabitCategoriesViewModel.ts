import { useNamedItemEditor } from '@/hooks';

import { useHabitsModule } from '../module';
import { useHabitCategories, useInvalidateHabits } from '../queries';

export function useHabitCategoriesViewModel() {
  const { habits } = useHabitsModule();
  const invalidate = useInvalidateHabits();
  const query = useHabitCategories();

  const editor = useNamedItemEditor({
    noun: 'category',
    save: habits.categories.save,
    remove: habits.categories.delete,
    onChanged: invalidate,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    ...editor,
  };
}
