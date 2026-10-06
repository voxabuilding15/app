import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';

import { useTagsViewModel } from '../view-models/useTagsViewModel';

export function TagsScreen() {
  const { refetch, ...vm } = useTagsViewModel();
  return (
    <>
      <Stack.Screen options={{ title: 'Session tags' }} />
      <CategoryManager
        {...vm}
        noun={{ singular: 'tag', plural: 'tags' }}
        onRetry={() => void refetch()}
        emptyMessage="Tags describe what a focus session was for, like Study, Writing or Admin."
      />
    </>
  );
}
