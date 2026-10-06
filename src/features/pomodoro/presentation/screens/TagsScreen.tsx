import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';
import { useTranslator } from '@/i18n';

import { useTagsViewModel } from '../view-models/useTagsViewModel';

export function TagsScreen() {
  const { t } = useTranslator();
  const { refetch, ...vm } = useTagsViewModel();
  return (
    <>
      <Stack.Screen options={{ title: t('Session tags') }} />
      <CategoryManager
        {...vm}
        noun="tag"
        onRetry={() => void refetch()}
        emptyMessage={t(
          'Tags describe what a focus session was for, like Study, Writing or Admin.',
        )}
      />
    </>
  );
}
