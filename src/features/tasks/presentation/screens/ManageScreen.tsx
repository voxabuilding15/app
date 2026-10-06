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
import { useTranslator } from '@/i18n';

import { useManageViewModel, type ManageKind } from '../view-models/useManageViewModel';
import { msg } from '@/i18n/msg';
import { NAMED_ITEM_TEXT } from '@/hooks';

const KIND_OPTIONS = [
  { value: 'category', label: msg('Categories') },
  { value: 'label', label: msg('Labels') },
] as const satisfies readonly { value: ManageKind; label: string }[];

export function ManageScreen() {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const vm = useManageViewModel();
  const words = NAMED_ITEM_TEXT[vm.kind === 'category' ? 'category' : 'label'];

  return (
    <>
      <Stack.Screen options={{ title: t('Categories & labels') }} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen>
          <SegmentedControl options={KIND_OPTIONS} value={vm.kind} onChange={vm.setKind} />
          {vm.isLoading ? (
            <ActivityIndicator color={colors.primary} accessibilityLabel={t('Loading')} />
          ) : vm.isError ? (
            <EmptyState
              icon="error-outline"
              title={t(words.loadError)}
              message={t('Your data is safe on this device. Try again.')}
              actionLabel={t('Try again')}
              onAction={() => void vm.refetch()}
            />
          ) : vm.items.length === 0 ? (
            <EmptyState
              icon={vm.kind === 'category' ? 'folder' : 'label'}
              title={t(words.empty)}
              message={
                vm.kind === 'category'
                  ? t('Categories group tasks, like Work or Home.')
                  : t('Labels tag tasks across categories, like Errand or Waiting.')
              }
              actionLabel={t(words.add)}
              onAction={() => vm.startEditing(null)}
            />
          ) : (
            <NamedItemList items={vm.items} onEdit={vm.startEditing} onDelete={vm.remove} />
          )}
        </Screen>
        <FAB icon="add" label={t(words.add)} onPress={() => vm.startEditing(null)} />
        {vm.failure ? <Snackbar message={vm.failure} onDismiss={vm.dismissFailure} /> : null}
      </View>

      {vm.editing ? (
        <NameColorSheet
          title={t(vm.editing.item ? words.edit : words.create)}
          initialName={vm.editing.item?.name ?? ''}
          initialColor={vm.editing.item?.color ?? ACCENT_COLORS[0]}
          onSave={vm.save}
          onClose={vm.stopEditing}
        />
      ) : null}
    </>
  );
}
