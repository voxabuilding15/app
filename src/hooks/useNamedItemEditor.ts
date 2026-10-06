import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { Category, NamedInput, SaveNameResult } from '@/core';
import { useTranslator } from '@/i18n';

import { NAMED_ITEM_TEXT, type NamedItemKind } from './named-item-text';

interface NamedItemEditorOptions {
  /** What the items are, e.g. "category". Used in prompts. */
  noun: NamedItemKind;
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
  const { t } = useTranslator();
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
        return t("Couldn't save. Please try again.");
      }
    },
    [editing, save, onChanged, t],
  );

  const confirmRemove = useCallback(
    (item: Category) => {
      Alert.alert(
        t(NAMED_ITEM_TEXT[noun].confirmTitle, { name: item.name }),
        t(NAMED_ITEM_TEXT[noun].confirmMessage),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Delete'),
            style: 'destructive',
            onPress: () => {
              remove(item.id)
                .then(onChanged)
                .catch(() => setFailure(t("Couldn't delete. Please try again.")));
            },
          },
        ],
      );
    },
    [noun, remove, onChanged, t],
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
