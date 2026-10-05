import { useNamedItemEditor } from '@/hooks';

import { useCalendarModule } from '../module';
import { useEventCategories, useInvalidateCalendar } from '../queries';

export function useCalendarCategoriesViewModel() {
  const { calendar } = useCalendarModule();
  const invalidate = useInvalidateCalendar();
  const query = useEventCategories();

  const editor = useNamedItemEditor({
    noun: 'category',
    save: calendar.categories.save,
    remove: calendar.categories.delete,
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
