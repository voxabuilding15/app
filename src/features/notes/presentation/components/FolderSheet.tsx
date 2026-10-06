import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Icon, Input, Sheet, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { FolderNode } from '../../domain/entities';
import { flattenFolderTree, folderPath } from '../../domain/folders';
import { FOLDER_NAME_MAX_LENGTH } from '../../domain/validation';
import { useFolderEditor } from '../view-models/useFoldersViewModel';

import { FolderPickerSheet } from './FolderPickerSheet';

interface FolderSheetProps {
  folder: FolderNode | null;
  parentId: string | null;
  tree: readonly FolderNode[];
  onClose: () => void;
}

/** Sheet to create, rename or move a folder. Mount only while open so state starts fresh. */
export function FolderSheet({ folder, parentId, tree, onClose }: FolderSheetProps) {
  const { t } = useTranslator();
  const editor = useFolderEditor(folder, parentId, onClose);
  const [picking, setPicking] = useState(false);
  const flat = flattenFolderTree(tree);
  const where = editor.parentId === null ? t('Top level') : folderPath(flat, editor.parentId);

  return (
    <>
      <Sheet visible title={folder === null ? t('New folder') : t('Edit folder')} onClose={onClose}>
        <Input
          label={t('Name')}
          value={editor.name}
          onChangeText={editor.setName}
          error={editor.errors.name}
          maxLength={FOLDER_NAME_MAX_LENGTH}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void editor.submit()}
        />
        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSmall" tone={editor.errors.parent ? 'error' : 'muted'}>
            {t('Inside')}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <Chip
              icon="folder"
              label={where}
              accessibilityLabel={t('Inside {where}. Change', { where: where })}
              onPress={() => setPicking(true)}
            />
          </View>
          {editor.errors.parent ? (
            <View
              accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', gap: spacing.xs }}
            >
              <Icon name="error-outline" size={16} />
              <Text variant="labelSmall" tone="error">
                {editor.errors.parent}
              </Text>
            </View>
          ) : null}
        </View>
        {editor.failure ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {editor.failure}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md }}>
          <Button label={t('Cancel')} variant="outlined" onPress={onClose} />
          <Button label={t('Save')} loading={editor.saving} onPress={() => void editor.submit()} />
        </View>
      </Sheet>
      {picking ? (
        <FolderPickerSheet
          title={t('Move inside')}
          tree={tree}
          selected={editor.parentId}
          noneLabel={t('Top level')}
          excludeId={folder?.id ?? null}
          onSelect={editor.setParentId}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </>
  );
}
