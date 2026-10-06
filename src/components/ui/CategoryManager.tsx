import { ActivityIndicator, View } from 'react-native';

import type { Category } from '@/core';
import { ACCENT_COLORS, useTheme } from '@/theme';

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
  noun?: { singular: string; plural: string };
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
  noun = { singular: 'category', plural: 'categories' },
}: CategoryManagerProps) {
  const { colors } = useTheme();

  return (
    <>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
          ) : isError ? (
            <EmptyState
              icon="error-outline"
              title={`Couldn't load ${noun.plural}`}
              message="Your data is safe on this device. Try again."
              actionLabel="Try again"
              onAction={onRetry}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="folder"
              title={`No ${noun.plural} yet`}
              message={emptyMessage}
              actionLabel={`Add ${noun.singular}`}
              onAction={() => startEditing(null)}
            />
          ) : (
            <NamedItemList items={items} onEdit={startEditing} onDelete={confirmRemove} />
          )}
        </Screen>
        <FAB icon="add" label={`Add ${noun.singular}`} onPress={() => startEditing(null)} />
        {failure ? <Snackbar message={failure} onDismiss={dismissFailure} /> : null}
      </View>

      {editing ? (
        <NameColorSheet
          title={`${editing.item ? 'Edit' : 'New'} ${noun.singular}`}
          initialName={editing.item?.name ?? ''}
          initialColor={editing.item?.color ?? ACCENT_COLORS[0]}
          onSave={submit}
          onClose={stopEditing}
        />
      ) : null}
    </>
  );
}
