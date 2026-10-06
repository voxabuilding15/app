import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { EmptyState, ResponsiveList } from '@/components';

import type { RecurringTransaction } from '../../domain/entities';
import { RecurringRow } from '../components/RecurringRow';
import { useCurrency } from '../queries';
import { useRecurringViewModel } from '../view-models/useRecurringViewModel';

/** Rules that add income, bills and transfers automatically on a schedule. */
export function RecurringSection() {
  const router = useRouter();
  const currency = useCurrency();
  const vm = useRecurringViewModel();
  const { remove, setPaused } = vm;

  const openNew = useCallback(() => router.push('/finance/recurring/new'), [router]);
  const handlePress = useCallback(
    (item: RecurringTransaction) =>
      router.push({ pathname: '/finance/recurring/[id]', params: { id: item.id } }),
    [router],
  );
  const handlePause = useCallback(
    (item: RecurringTransaction, paused: boolean) => void setPaused(item, paused),
    [setPaused],
  );
  const handleDelete = useCallback((item: RecurringTransaction) => void remove(item.id), [remove]);

  return (
    <ResponsiveList
      data={vm.items}
      keyExtractor={(item) => item.id}
      renderItem={(item) => (
        <RecurringRow
          item={item}
          currency={currency}
          onPress={handlePress}
          onPause={handlePause}
          onDelete={handleDelete}
        />
      )}
      extraData={currency}
      noun="recurring transactions"
      isLoading={vm.isLoading}
      isError={vm.isError}
      onRetry={() => void vm.refetch()}
      empty={
        <EmptyState
          icon="repeat"
          title="Nothing recurring yet"
          message="Add a salary, rent or subscription once and it is recorded for you every time."
          actionLabel="Add recurring transaction"
          onAction={openNew}
        />
      }
      isRefreshing={vm.isRefreshing}
      onRefresh={() => void vm.refetch()}
      fab={{ label: 'Add recurring transaction', onPress: openNew }}
      notice={vm.notice}
      onDismissNotice={vm.dismissNotice}
    />
  );
}
