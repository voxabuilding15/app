import { memo } from 'react';

import type { SwipeAction } from '@/components';
import { useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { Transaction } from '../../domain/entities';
import {
  TRANSACTION_TYPE_ICON,
  describeFlow,
  describeTransaction,
  formatDate,
  formatSignedAmount,
  formatTime,
} from '../format';

import { MoneyRow } from './MoneyRow';

export interface TransactionRowProps {
  item: Transaction;
  now: number;
  currency: string;
  onPress: (item: Transaction) => void;
  onDelete: (item: Transaction) => void;
  onDuplicate: (item: Transaction) => void;
}

function TransactionRowComponent({
  item,
  now,
  currency,
  onPress,
  onDelete,
  onDuplicate,
}: TransactionRowProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();

  const accent =
    item.category?.color ?? (item.type === 'income' ? colors.success : colors.onSurfaceVariant);
  const title =
    item.category?.name ?? (item.type === 'transfer' ? t('Transfer') : t('Uncategorized'));
  const subtitle = [
    item.note || null,
    describeFlow(item),
    `${formatDate(item.occurredAt, now)}, ${formatTime(item.occurredAt)}`,
    item.recurringId === null ? null : t('Repeating'),
  ]
    .filter(Boolean)
    .join(' · ');

  const rightActions: SwipeAction[] = [
    {
      label: t('Delete'),
      icon: 'delete',
      background: colors.error,
      foreground: colors.surface,
      onPress: () => onDelete(item),
    },
  ];
  const leftActions: SwipeAction[] = [
    {
      label: t('Duplicate'),
      icon: 'content-copy',
      background: colors.secondaryContainer,
      foreground: colors.onSecondaryContainer,
      onPress: () => onDuplicate(item),
    },
  ];

  return (
    <MoneyRow
      icon={TRANSACTION_TYPE_ICON[item.type]}
      accent={accent}
      title={title}
      subtitle={subtitle}
      amountText={formatSignedAmount(item.type, item.amountMinor, currency)}
      amountColor={
        item.type === 'income'
          ? colors.success
          : item.type === 'expense'
            ? colors.error
            : colors.onSurface
      }
      label={describeTransaction(item, now, currency)}
      leftActions={leftActions}
      rightActions={rightActions}
      accessibilityActions={[
        { name: 'duplicate', label: t('Duplicate'), run: () => onDuplicate(item) },
        { name: 'delete', label: t('Delete'), run: () => onDelete(item) },
      ]}
      onPress={() => onPress(item)}
    />
  );
}

export const TransactionRow = memo(TransactionRowComponent);
