import { useState } from 'react';

import { useNamedItemEditor } from '@/hooks';

import { useTasksModule } from '../module';
import { useInvalidateTasks, useTaxonomy } from '../queries';

export type ManageKind = 'category' | 'label';

export function useManageViewModel() {
  const { taxonomy } = useTasksModule();
  const invalidate = useInvalidateTasks();
  const query = useTaxonomy();
  const [kind, setKind] = useState<ManageKind>('category');

  const categoryEditor = useNamedItemEditor({
    noun: 'category',
    save: taxonomy.saveCategory,
    remove: taxonomy.deleteCategory,
    onChanged: invalidate,
  });
  const labelEditor = useNamedItemEditor({
    noun: 'label',
    save: taxonomy.saveLabel,
    remove: taxonomy.deleteLabel,
    onChanged: invalidate,
  });
  const editor = kind === 'category' ? categoryEditor : labelEditor;

  return {
    kind,
    setKind,
    items: (kind === 'category' ? query.data?.categories : query.data?.labels) ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    editing: editor.editing,
    startEditing: editor.startEditing,
    stopEditing: editor.stopEditing,
    save: editor.submit,
    remove: editor.confirmRemove,
    failure: editor.failure,
    dismissFailure: editor.dismissFailure,
  };
}
