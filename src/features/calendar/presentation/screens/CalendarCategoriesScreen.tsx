import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';

import { useCalendarCategoriesViewModel } from '../view-models/useCalendarCategoriesViewModel';

export function CalendarCategoriesScreen() {
  const vm = useCalendarCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: 'Event categories' }} />
      <CategoryManager
        {...vm}
        onRetry={() => void vm.refetch()}
        emptyMessage="Categories give your events colors, like Work or Family."
      />
    </>
  );
}
