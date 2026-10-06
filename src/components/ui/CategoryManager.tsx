import { ActivityIndicator, View } from 'react-native';

import type { Category } from '@/core';
import { ACCENT_COLORS, useTheme } from '@/theme';
import { NAMED_ITEM_TEXT, type NamedItemKind } from '@/hooks';
import { useTranslator } from '@/i18n';

import { EmptyState } from './EmptyState';
import { FAB } from './FAB';
import { NameColorSheet } from './NameColorSheet';
import { NamedItemList } from './NamedItemList';
import { Screen } from './Screen';
import { Snackbar } from './Snackbar';

interface CategoryManagerProps {
  items: readonly Category[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Editor state from `useNamedItemEditor`. */
  editing: { item: Category | null } | null;
  startEditing: (item: Category | null) => void;
  stopEditing: () => void;
  submit: (name: string, color: string) => Promise<string | null>;
  confirmRemove: (item: Category) => void;
  failure: string | null;
  dismissFailure: () => void;
  /** Explains what categories are for, shown when there are none. */
  emptyMessage: string;
  /** What the items are called; defaults to categories. */
  /** What the items are, so the texts read naturally in every language. */
  noun?: NamedItemKind;
}

/** Full screen body for managing a feature's categories. */
export function CategoryManager({
  items,
  isLoading,
  isError,
  onRetry,
  editing,
  startEditing,
  stopEditing,
  submit,
  confirmRemove,
  failure,
  dismissFailure,
  emptyMessage,
  noun = 'category',
}: CategoryManagerProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel={t('Loading')} />
          ) : isError ? (
            <EmptyState
              icon="error-outline"
              title={t(NAMED_ITEM_TEXT[noun].loadError)}
              message={t('Your data is safe on this device. Try again.')}
              actionLabel={t('Try again')}
              onAction={onRetry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="folder"
              title={t(NAMED_ITEM_TEXT[noun].empty)}
              message={emptyMessage}
              actionLabel={t(NAMED_ITEM_TEXT[noun].add)}
              onAction={() => startEditing(null)}
            />
          ) : (
            <NamedItemList items={items} onEdit={startEditing} onDelete={confirmRemove} />
          )}
        </Screen>
        <FAB icon="add" label={t(NAMED_ITEM_TEXT[noun].add)} onPress={() => startEditing(null)} />
        {failure ? <Snackbar message={failure} onDismiss={dismissFailure} /> : null}
      </View>

      {editing ? (
        <NameColorSheet
          title={t(NAMED_ITEM_TEXT[noun][editing.item ? 'edit' : 'create'])}
          initialName={editing.item?.name ?? ''}
          initialColor={editing.item?.color ?? ACCENT_COLORS[0]}
          onSave={submit}
          onClose={stopEditing}
        />
      ) : null}
    </>
  );
}
