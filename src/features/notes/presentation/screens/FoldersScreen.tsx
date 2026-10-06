import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { EmptyState, FAB, IconButton, Icon, Screen, Snackbar, Text } from '@/components';
import { MIN_TOUCH_TARGET, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { FolderNode } from '../../domain/entities';
import { flattenFolderTree } from '../../domain/folders';
import { FolderSheet } from '../components/FolderSheet';
import { useFoldersViewModel } from '../view-models/useFoldersViewModel';

function FolderRow({
  folder,
  onEdit,
  onAddInside,
  onDelete,
}: {
  folder: FolderNode;
  onEdit: () => void;
  onAddInside: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  return (
    <View
      style={{
        minHeight: MIN_TOUCH_TARGET + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingLeft: folder.depth * spacing.xl,
      }}
    >
      <Icon name="folder" color={colors.primary} />
      <View
        accessible
        accessibilityLabel={`${folder.name}, ${folder.noteCount} ${folder.noteCount === 1 ? 'note' : 'notes'}`}
        style={{ flex: 1 }}
      >
        <Text variant="bodyLarge" numberOfLines={1}>
          {folder.name}
        </Text>
        <Text variant="labelSmall" tone="muted">
          {`${folder.noteCount} ${folder.noteCount === 1 ? 'note' : 'notes'}`}
        </Text>
      </View>
      <IconButton
        icon="create-new-folder"
        label={t('New folder inside {name}', { name: folder.name })}
        onPress={onAddInside}
      />
      <IconButton icon="edit" label={t('Edit {name}', { name: folder.name })} onPress={onEdit} />
      <IconButton
        icon="delete"
        label={t('Delete {name}', { name: folder.name })}
        onPress={onDelete}
      />
    </View>
  );
}

/** Create, rename, move and delete folders, which can be nested. */
export function FoldersScreen() {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const vm = useFoldersViewModel();
  const rows = flattenFolderTree(vm.tree);

  return (
    <>
      <Stack.Screen options={{ title: t('Folders') }} />
      <View style={{ flex: 1 }}>
        {vm.isLoading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel={t('Loading folders')}
            style={{ marginTop: spacing.xxl }}
          />
        ) : vm.isError ? (
          <Screen>
            <EmptyState
              icon="error-outline"
              title={t("Couldn't load folders")}
              message={t('Your notes are safe on this device. Try again.')}
              actionLabel={t('Try again')}
              onAction={() => void vm.refetch()}
            />
          </Screen>
        ) : rows.length === 0 ? (
          <Screen>
            <EmptyState
              icon="folder-open"
              title={t('No folders yet')}
              message={t('Folders keep related notes together, and can be nested.')}
              actionLabel={t('Add folder')}
              onAction={() => vm.startEditing(null, null)}
            />
          </Screen>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96 }}>
            {rows.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                onEdit={() => vm.startEditing(folder)}
                onAddInside={() => vm.startEditing(null, folder.id)}
                onDelete={() => vm.confirmRemove(folder)}
              />
            ))}
          </ScrollView>
        )}
        <FAB
          icon="create-new-folder"
          label={t('Add folder')}
          onPress={() => vm.startEditing(null, null)}
        />
        {vm.notice ? (
          <Snackbar message={vm.notice} onDismiss={vm.dismissNotice} bottomOffset={88} />
        ) : null}
      </View>
      {vm.editing !== undefined ? (
        <FolderSheet
          folder={vm.editing.folder}
          parentId={vm.editing.parentId}
          tree={vm.tree}
          onClose={vm.stopEditing}
        />
      ) : null}
    </>
  );
}
