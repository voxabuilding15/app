import { useCallback } from 'react';
import { View } from 'react-native';

import { EmptyState, StatTile, SwitchRow } from '@/components';
import { formatMoney } from '@/core';
import { spacing } from '@/theme';

import type { AccountBalance } from '../../domain/entities';
import { AccountRow } from '../components/AccountRow';
import { AccountSheet } from '../components/AccountSheet';
import { FinanceList } from '../components/FinanceList';
import { useCurrency } from '../queries';
import { useAccountsViewModel } from '../view-models/useAccountsViewModel';

interface AccountsSectionProps {
  /** Shows the transactions of one account in the activity tab. */
  onShowTransactions: (accountId: string) => void;
}

/** Cash, bank, savings and credit card accounts with their balances. */
export function AccountsSection({ onShowTransactions }: AccountsSectionProps) {
  const currency = useCurrency();
  const vm = useAccountsViewModel();
  const { startEditing, remove, setArchived } = vm;

  const handlePress = useCallback(
    (account: AccountBalance) => startEditing(account),
    [startEditing],
  );
  const handleShow = useCallback(
    (account: AccountBalance) => onShowTransactions(account.id),
    [onShowTransactions],
  );
  const handleArchive = useCallback(
    (account: AccountBalance, archived: boolean) => void setArchived(account, archived),
    [setArchived],
  );
  const handleDelete = useCallback((account: AccountBalance) => void remove(account.id), [remove]);

  return (
    <View style={{ flex: 1 }}>
      <FinanceList
        data={vm.accounts}
        keyExtractor={(account) => account.id}
        renderItem={(account) => (
          <AccountRow
            account={account}
            currency={currency}
            onPress={handlePress}
            onShowTransactions={handleShow}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        )}
        extraData={currency}
        noun="accounts"
        isLoading={vm.isLoading}
        isError={vm.isError}
        onRetry={() => void vm.refetch()}
        empty={
          <EmptyState
            icon="account-balance-wallet"
            title="No accounts yet"
            message="Add cash, a bank account, savings or a credit card to start tracking your money."
            actionLabel="Add account"
            onAction={() => startEditing(null)}
          />
        }
        header={
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row' }}>
              <StatTile
                icon="account-balance-wallet"
                label="Total balance"
                value={formatMoney(vm.totalMinor, currency)}
                caption="All active accounts"
              />
            </View>
            <SwitchRow
              title="Show archived accounts"
              value={vm.showArchived}
              onChange={vm.setShowArchived}
            />
          </View>
        }
        isRefreshing={vm.isRefreshing}
        onRefresh={() => void vm.refetch()}
        fab={{ label: 'Add account', onPress: () => startEditing(null) }}
        notice={vm.notice}
        onDismissNotice={vm.dismissNotice}
      />
      {vm.editing !== undefined ? (
        <AccountSheet account={vm.editing} onClose={vm.stopEditing} />
      ) : null}
    </View>
  );
}
