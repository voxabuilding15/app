import { Stack } from 'expo-router';

import { CategoryManager } from '@/components';

import { useTagsViewModel } from '../view-models/useTagsViewModel';

export function TagsScreen() {
  const { refetch, ...vm } = useTagsViewModel();
  return (
    <>
      <Stack.Screen options={{ title: 'Tags' }} />
      <CategoryManager
        {...vm}
        noun={{ singular: 'tag', plural: 'tags' }}
        onRetry={() => void refetch()}
        emptyMessage="Tags group notes across folders, like Ideas, Recipes or Work."
      />
    </>
  );
}
