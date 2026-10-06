import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { FolderNode } from '../../domain/entities';
import type { FolderErrors } from '../../domain/validation';
import { useNotesModule } from '../module';
import { useFolderTree, useInvalidateNotes } from '../queries';

export type FolderEditing = { folder: FolderNode | null; parentId: string | null } | undefined;

export function useFoldersViewModel() {
  const { folders: useCases } = useNotesModule();
  const invalidate = useInvalidateNotes();
  const tree = useFolderTree();

  /** The folder being edited (or created under `parentId`); undefined while the sheet is closed. */
  const [editing, setEditing] = useState<FolderEditing>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const remove = useCallback(
    async (folder: FolderNode) => {
      try {
        await useCases.remove(folder.id);
        setNotice(`"${folder.name}" deleted. Its notes moved up one level.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Couldn't delete the folder.");
      }
      await invalidate();
    },
    [useCases, invalidate],
  );

  const confirmRemove = useCallback(
    (folder: FolderNode) =>
      Alert.alert(
        `Delete "${folder.name}"?`,
        'The notes and folders inside move up one level. Nothing else is deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete folder', style: 'destructive', onPress: () => void remove(folder) },
        ],
      ),
    [remove],
  );

  return {
    tree: tree.data ?? [],
    isLoading: tree.isPending,
    isError: tree.isError,
    refetch: tree.refetch,
    editing,
    startEditing: (folder: FolderNode | null, parentId: string | null = folder?.parentId ?? null) =>
      setEditing({ folder, parentId }),
    stopEditing: () => setEditing(undefined),
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    confirmRemove,
  };
}

/** Form state for the folder sheet. Mount it only while the sheet is open. */
export function useFolderEditor(
  folder: FolderNode | null,
  initialParentId: string | null,
  onSaved: () => void,
) {
  const { folders } = useNotesModule();
  const invalidate = useInvalidateNotes();

  const [name, setName] = useState(folder?.name ?? '');
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [errors, setErrors] = useState<FolderErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = useCallback(async () => {
    setSaving(true);
    setFailure(null);
    try {
      const result = await folders.save({ name, parentId }, folder?.id ?? null);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      onSaved();
    } catch {
      setFailure("Couldn't save the folder. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [folders, name, parentId, folder, invalidate, onSaved]);

  return {
    name,
    parentId,
    errors,
    failure,
    saving,
    setName: (text: string) => {
      setName(text);
      setErrors(({ name: _name, ...rest }) => rest);
    },
    setParentId: (id: string | null) => {
      setParentId(id);
      setErrors(({ parent: _parent, ...rest }) => rest);
    },
    submit,
  };
}
