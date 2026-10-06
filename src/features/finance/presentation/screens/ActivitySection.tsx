import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, ListControls, SortSheet, ResponsiveList } from '@/components';
import { useNow } from '@/hooks';

import type { Transaction } from '../../domain/entities';
import { SummaryTiles } from '../components/SummaryTiles';
import { TransactionFilterSheet } from '../components/TransactionFilterSheet';
import { TransactionRow } from '../components/TransactionRow';
import { SORT_FIELDS, sortLabel } from '../options';
import { useCurrency } from '../queries';
import { useTransactionListViewModel } from '../view-models/useTransactionListViewModel';
import { totalBalanceMinor } from '../../domain/account-usecases';

interface ActivitySectionProps {
  /** Starts filtered to one account. */
  initialAccountId: string | null;
  /** Switches to the accounts tab, for when there is no account to add a transaction to. */
  onShowAccounts: () => void;
}

/** Transactions with search, filters and sorting, plus this month at a glance. */
export function ActivitySection({ initialAccountId, onShowAccounts }: ActivitySectionProps) {
  const router = useRouter();
  const now = useNow();
  const currency = useCurrency();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const openTransaction = useCallback(
    (id: string) => router.push({ pathname: '/finance/transaction/[id]', params: { id } }),
    [router],
  );
  const vm = useTransactionListViewModel({ initialAccountId, onOpen: openTransaction });
  const { remove, duplicate } = vm;

  const addTransaction = useCallback(() => {
    if (vm.hasAccounts) {
      router.push({
        pathname: '/finance/transaction/new',
        params: vm.filter.accountId === null ? {} : { accountId: vm.filter.accountId },
      });
    } else {
      onShowAccounts();
    }
  }, [vm.hasAccounts, vm.filter.accountId, router, onShowAccounts]);

  const handlePress = useCallback(
    (item: Transaction) => openTransaction(item.id),
    [openTransaction],
  );
  const handleDelete = useCallback((item: Transaction) => void remove(item.id), [remove]);
  const handleDuplicate = useCallback((item: Transaction) => void duplicate(item), [duplicate]);

  const empty = !vm.hasAccounts ? (
    <EmptyState
      icon="account-balance-wallet"
      title="Add an account first"
      message="Transactions belong to an account, such as Cash or a bank account."
      actionLabel="Add account"
      onAction={onShowAccounts}
    />
  ) : vm.isFiltering ? (
    <EmptyState
      icon="search-off"
      title="No matching transactions"
      message="Nothing matches your search and filters."
      actionLabel="Clear search and filters"
      onAction={vm.clearFilters}
    />
  ) : (
    <EmptyState
      icon="receipt-long"
      title="No transactions yet"
      message="Record income, expenses and transfers between your accounts."
      actionLabel="Add transaction"
      onAction={addTransaction}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <ListControls
        searchOpen={vm.searchOpen}
        onToggleSearch={vm.toggleSearch}
        searchText={vm.searchText}
        onSearchText={vm.setSearchText}
        searchLabel="Search transactions"
        searchPlaceholder="Note, category or account"
        activeFilterCount={vm.activeFilterCount}
        isFiltering={vm.isFiltering}
        onOpenFilter={() => setFilterOpen(true)}
        sortLabel={sortLabel(vm.sort.field)}
        sortAscending={vm.sort.direction === 'asc'}
        onOpenSort={() => setSortOpen(true)}
        onClear={vm.clearFilters}
      />
      <ResponsiveList
        data={vm.items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => (
          <TransactionRow
            item={item}
            now={now}
            currency={currency}
            onPress={handlePress}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        )}
        extraData={currency}
        noun="transactions"
        isLoading={vm.isLoading}
        isError={vm.isError}
        onRetry={() => void vm.refetch()}
        empty={empty}
        header={
          vm.isFiltering ? null : (
            <SummaryTiles
              balanceMinor={totalBalanceMinor(vm.accounts)}
              flow={vm.monthFlow}
              currency={currency}
            />
          )
        }
        isRefreshing={vm.isRefreshing}
        onRefresh={() => void vm.refetch()}
        onEndReached={vm.loadMore}
        fab={{ label: 'Add transaction', onPress: addTransaction }}
        notice={vm.notice}
        onDismissNotice={vm.dismissNotice}
      />

      <TransactionFilterSheet
        visible={filterOpen}
        filter={vm.filter}
        accounts={vm.accounts}
        categories={vm.categories}
        onChange={vm.updateFilter}
        onReset={vm.clearFilters}
        onClose={() => setFilterOpen(false)}
      />
      <SortSheet
        visible={sortOpen}
        title="Sort transactions"
        fields={SORT_FIELDS.map((value) => ({ value, label: sortLabel(value) }))}
        sort={vm.sort}
        onChange={vm.changeSort}
        onClose={() => setSortOpen(false)}
      />
    </View>
  );
}
