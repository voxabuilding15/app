import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { Category, NamedInput, SaveNameResult } from '@/core';

interface NamedItemEditorOptions {
  /** What the items are called, e.g. "category". Used in prompts. */
  noun: string;
  save: (input: NamedInput) => Promise<SaveNameResult>;
  remove: (id: string) => Promise<void>;
  /** Refreshes whatever displays the items after a change. */
  onChanged: () => Promise<unknown>;
}

interface EditTarget {
  /** The item being edited, or null when creating a new one. */
  item: Category | null;
}

/** State for creating, renaming and deleting named, colored items such as categories and labels. */
export function useNamedItemEditor({ noun, save, remove, onChanged }: NamedItemEditorOptions) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /** Returns a validation message to show, or null once saved. */
  const submit = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      try {
        const result = await save({ id: editing?.item?.id ?? null, name, color });
        if (!result.ok) {
          return result.error;
        }
        await onChanged();
        setEditing(null);
        return null;
      } catch {
        return "Couldn't save. Please try again.";
      }
    },
    [editing, save, onChanged],
  );

  const confirmRemove = useCallback(
    (item: Category) => {
      Alert.alert(
        `Delete ${noun} "${item.name}"?`,
        `Items keep existing; they just lose this ${noun}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              remove(item.id)
                .then(onChanged)
                .catch(() => setFailure("Couldn't delete. Please try again."));
            },
          },
        ],
      );
    },
    [noun, remove, onChanged],
  );

  return {
    editing,
    startEditing: (item: Category | null) => setEditing({ item }),
    stopEditing: () => setEditing(null),
    submit,
    confirmRemove,
    failure,
    dismissFailure: () => setFailure(null),
  };
}
