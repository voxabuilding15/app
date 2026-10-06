import { useNamedItemEditor } from '@/hooks';

import { usePomodoroModule } from '../module';
import { useInvalidatePomodoro, useTags } from '../queries';

export function useTagsViewModel() {
  const { tags } = usePomodoroModule();
  const invalidate = useInvalidatePomodoro();
  const query = useTags();
  const editor = useNamedItemEditor({
    noun: 'tag',
    save: tags.save,
    remove: tags.delete,
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
