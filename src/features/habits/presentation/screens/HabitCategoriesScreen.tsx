import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';

import { useHabitCategoriesViewModel } from '../view-models/useHabitCategoriesViewModel';

export function HabitCategoriesScreen() {
  const vm = useHabitCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: 'Habit categories' }} />
      <CategoryManager
        {...vm}
        onRetry={() => void vm.refetch()}
        emptyMessage="Categories group habits, like Health or Mindfulness."
      />
    </>
  );
}
