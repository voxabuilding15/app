import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';
import { useTranslator } from '@/i18n';

import { useHabitCategoriesViewModel } from '../view-models/useHabitCategoriesViewModel';

export function HabitCategoriesScreen() {
  const { t } = useTranslator();
  const vm = useHabitCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: t('Habit categories') }} />
      <CategoryManager
        {...vm}
        onRetry={() => void vm.refetch()}
        emptyMessage={t('Categories group habits, like Health or Mindfulness.')}
      />
    </>
  );
}
