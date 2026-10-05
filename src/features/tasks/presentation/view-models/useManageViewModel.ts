import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { Category, Label } from '../../domain/entities';
import { useTasksModule } from '../module';
import { useInvalidateTasks, useTaxonomy } from '../queries';

export type ManageKind = 'category' | 'label';

export interface EditTarget {
  kind: ManageKind;
  item: Category | Label | null;
}

export function useManageViewModel() {
  const { taxonomy: useCases } = useTasksModule();
  const invalidate = useInvalidateTasks();
  const query = useTaxonomy();
  const [kind, setKind] = useState<ManageKind>('category');
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const items = (kind === 'category' ? query.data?.categories : query.data?.labels) ?? [];

  /** Returns a validation message, or null when saved. */
  const save = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      if (editing === null) {
        return null;
      }
      const input = { id: editing.item?.id ?? null, name, color };
      try {
        const result =
          editing.kind === 'category'
            ? await useCases.saveCategory(input)
            : await useCases.saveLabel(input);
        if (!result.ok) {
          return result.error;
        }
        await invalidate();
        setEditing(null);
        return null;
      } catch {
        return "Couldn't save. Please try again.";
      }
    },
    [editing, useCases, invalidate],
  );

  const remove = useCallback(
    (item: Category | Label) => {
      const noun = kind === 'category' ? 'category' : 'label';
      Alert.alert(
        `Delete ${noun} "${item.name}"?`,
        `Tasks keep existing; they just lose this ${noun}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const action =
                kind === 'category'
                  ? useCases.deleteCategory(item.id)
                  : useCases.deleteLabel(item.id);
              action.then(invalidate).catch(() => setFailure("Couldn't delete. Please try again."));
            },
          },
        ],
      );
    },
    [kind, useCases, invalidate],
  );

  return {
    kind,
    setKind,
    items,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    editing,
    startEditing: (item: Category | Label | null) => setEditing({ kind, item }),
    stopEditing: () => setEditing(null),
    failure,
    dismissFailure: () => setFailure(null),
    save,
    remove,
  };
}
