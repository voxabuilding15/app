import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  EmptyState,
  FAB,
  NameColorSheet,
  NamedItemList,
  Screen,
  SegmentedControl,
  Snackbar,
} from '@/components';
import { ACCENT_COLORS, useTheme } from '@/theme';

import { useManageViewModel, type ManageKind } from '../view-models/useManageViewModel';

const KIND_OPTIONS = [
  { value: 'category', label: 'Categories' },
  { value: 'label', label: 'Labels' },
] as const satisfies readonly { value: ManageKind; label: string }[];

export function ManageScreen() {
  const { colors } = useTheme();
  const vm = useManageViewModel();
  const noun = vm.kind === 'category' ? 'category' : 'label';
  const plural = vm.kind === 'category' ? 'categories' : 'labels';

  return (
    <>
      <Stack.Screen options={{ title: 'Categories & labels' }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen>
          <SegmentedControl options={KIND_OPTIONS} value={vm.kind} onChange={vm.setKind} />
          {vm.isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
          ) : vm.isError ? (
            <EmptyState
              icon="error-outline"
              title={`Couldn't load ${plural}`}
              message="Your data is safe on this device. Try again."
              actionLabel="Try again"
              onAction={() => void vm.refetch()}
            />
          ) : vm.items.length === 0 ? (
            <EmptyState
              icon={vm.kind === 'category' ? 'folder' : 'label'}
              title={`No ${plural} yet`}
              message={
                vm.kind === 'category'
                  ? 'Categories group tasks, like Work or Home.'
                  : 'Labels tag tasks across categories, like Errand or Waiting.'
              }
              actionLabel={`Add ${noun}`}
              onAction={() => vm.startEditing(null)}
            />
          ) : (
            <NamedItemList items={vm.items} onEdit={vm.startEditing} onDelete={vm.remove} />
          )}
        </Screen>
        <FAB icon="add" label={`Add ${noun}`} onPress={() => vm.startEditing(null)} />
        {vm.failure ? <Snackbar message={vm.failure} onDismiss={vm.dismissFailure} /> : null}
      </View>

      {vm.editing ? (
        <NameColorSheet
          title={`${vm.editing.item ? 'Edit' : 'New'} ${noun}`}
          initialName={vm.editing.item?.name ?? ''}
          initialColor={vm.editing.item?.color ?? ACCENT_COLORS[0]}
          onSave={vm.save}
          onClose={vm.stopEditing}
        />
      ) : null}
    </>
  );
}
