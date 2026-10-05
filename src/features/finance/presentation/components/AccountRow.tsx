import { memo } from 'react';

import { formatMoney } from '@/core';
import type { SwipeAction } from '@/components';
import { useTheme } from '@/theme';

import type { AccountBalance } from '../../domain/entities';
import { ACCOUNT_TYPE_ICON, ACCOUNT_TYPE_LABEL } from '../format';

import { MoneyRow } from './MoneyRow';

export interface AccountRowProps {
  account: AccountBalance;
  currency: string;
  onPress: (account: AccountBalance) => void;
  onShowTransactions: (account: AccountBalance) => void;
  onArchive: (account: AccountBalance, archived: boolean) => void;
  onDelete: (account: AccountBalance) => void;
}

function describe(account: AccountBalance, currency: string): string {
  return [
    account.name,
    ACCOUNT_TYPE_LABEL[account.type],
    `balance ${formatMoney(account.balanceMinor, currency)}`,
    account.archivedAt === null ? null : 'archived',
  ]
    .filter(Boolean)
    .join(', ');
}

function AccountRowComponent({
  account,
  currency,
  onPress,
  onShowTransactions,
  onArchive,
  onDelete,
}: AccountRowProps) {
  const { colors } = useTheme();
  const archived = account.archivedAt !== null;

  const rightActions: SwipeAction[] = [
    {
      label: archived ? 'Restore' : 'Archive',
      icon: archived ? 'unarchive' : 'archive',
      background: colors.secondaryContainer,
      foreground: colors.onSecondaryContainer,
      onPress: () => onArchive(account, !archived),
    },
    {
      label: 'Delete',
      icon: 'delete',
      background: colors.error,
      foreground: colors.surface,
      onPress: () => onDelete(account),
    },
  ];
  const leftActions: SwipeAction[] = [
    {
      label: 'Activity',
      icon: 'receipt-long',
      background: colors.primary,
      foreground: colors.onPrimary,
      onPress: () => onShowTransactions(account),
    },
  ];

  const count = account.transactionCount;
  return (
    <MoneyRow
      icon={ACCOUNT_TYPE_ICON[account.type]}
      accent={account.color}
      title={account.name}
      subtitle={[
        ACCOUNT_TYPE_LABEL[account.type],
        `${count} ${count === 1 ? 'transaction' : 'transactions'}`,
        archived ? 'Archived' : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      amountText={formatMoney(account.balanceMinor, currency)}
      amountColor={account.balanceMinor < 0 ? colors.error : colors.onSurface}
      label={describe(account, currency)}
      dimmed={archived}
      leftActions={leftActions}
      rightActions={rightActions}
      accessibilityActions={[
        { name: 'activity', label: 'Show transactions', run: () => onShowTransactions(account) },
        {
          name: 'archive',
          label: archived ? 'Restore' : 'Archive',
          run: () => onArchive(account, !archived),
        },
        { name: 'delete', label: 'Delete', run: () => onDelete(account) },
      ]}
      onPress={() => onPress(account)}
    />
  );
}

export const AccountRow = memo(AccountRowComponent);
