import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';
import { useTranslator } from '@/i18n';

import { useCalendarCategoriesViewModel } from '../view-models/useCalendarCategoriesViewModel';

export function CalendarCategoriesScreen() {
  const { t } = useTranslator();
  const vm = useCalendarCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: t('Event categories') }} />
      <CategoryManager
        {...vm}
        onRetry={() => void vm.refetch()}
        emptyMessage={t('Categories give your events colors, like Work or Family.')}
      />
    </>
  );
}
