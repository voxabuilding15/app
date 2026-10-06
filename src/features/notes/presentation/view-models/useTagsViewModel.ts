import { useNamedItemEditor } from '@/hooks';

import { useNotesModule } from '../module';
import { useInvalidateNotes, useTags } from '../queries';

export function useTagsViewModel() {
  const { tags } = useNotesModule();
  const invalidate = useInvalidateNotes();
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
