import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { EmptyState, FAB, NameColorSheet, NamedItemList, Screen, Snackbar } from '@/components';
import { ACCENT_COLORS, useTheme } from '@/theme';

import { useHabitCategoriesViewModel } from '../view-models/useHabitCategoriesViewModel';

export function HabitCategoriesScreen() {
  const { colors } = useTheme();
  const vm = useHabitCategoriesViewModel();

  return (
    <>
      <Stack.Screen options={{ title: 'Habit categories' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen>
          {vm.isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
          ) : vm.isError ? (
            <EmptyState
              icon="error-outline"
              title="Couldn't load categories"
              message="Your data is safe on this device. Try again."
              actionLabel="Try again"
              onAction={() => void vm.refetch()}
            />
          ) : vm.items.length === 0 ? (
            <EmptyState
              icon="folder"
              title="No categories yet"
              message="Categories group habits, like Health or Mindfulness."
              actionLabel="Add category"
              onAction={() => vm.startEditing(null)}
            />
          ) : (
            <NamedItemList items={vm.items} onEdit={vm.startEditing} onDelete={vm.confirmRemove} />
          )}
        </Screen>
        <FAB icon="add" label="Add category" onPress={() => vm.startEditing(null)} />
        {vm.failure ? <Snackbar message={vm.failure} onDismiss={vm.dismissFailure} /> : null}
      </View>

      {vm.editing ? (
        <NameColorSheet
          title={vm.editing.item ? 'Edit category' : 'New category'}
          initialName={vm.editing.item?.name ?? ''}
          initialColor={vm.editing.item?.color ?? ACCENT_COLORS[0]}
          onSave={vm.submit}
          onClose={vm.stopEditing}
        />
      ) : null}
    </>
  );
}
