import { memo } from 'react';

import type { SwipeAction } from '@/components';
import { useTheme } from '@/theme';

import type { RecurringTransaction } from '../../domain/entities';
import {
  TRANSACTION_TYPE_ICON,
  TRANSACTION_TYPE_LABEL,
  describeFlow,
  describeRecurring,
  describeSchedule,
  formatSignedAmount,
} from '../format';

import { MoneyRow } from './MoneyRow';

export interface RecurringRowProps {
  item: RecurringTransaction;
  currency: string;
  onPress: (item: RecurringTransaction) => void;
  onPause: (item: RecurringTransaction, paused: boolean) => void;
  onDelete: (item: RecurringTransaction) => void;
}

function RecurringRowComponent({ item, currency, onPress, onPause, onDelete }: RecurringRowProps) {
  const { colors } = useTheme();
  const finished = item.nextDate === null && !item.paused;

  const rightActions: SwipeAction[] = [
    {
      label: 'Delete',
      icon: 'delete',
      background: colors.error,
      foreground: colors.surface,
      onPress: () => onDelete(item),
    },
  ];
  const leftActions: SwipeAction[] = finished
    ? []
    : [
        {
          label: item.paused ? 'Resume' : 'Pause',
          icon: item.paused ? 'play-arrow' : 'pause',
          background: colors.secondaryContainer,
          foreground: colors.onSecondaryContainer,
          onPress: () => onPause(item, !item.paused),
        },
      ];

  return (
    <MoneyRow
      icon={TRANSACTION_TYPE_ICON[item.type]}
      accent={item.category?.color ?? colors.primary}
      title={item.note || item.category?.name || TRANSACTION_TYPE_LABEL[item.type]}
      subtitle={`${describeFlow(item)} · ${describeSchedule(item)}`}
      amountText={formatSignedAmount(item.type, item.amountMinor, currency)}
      amountColor={
        item.type === 'income'
          ? colors.success
          : item.type === 'expense'
            ? colors.error
            : colors.onSurface
      }
      label={describeRecurring(item, currency)}
      dimmed={item.paused || finished}
      leftActions={leftActions}
      rightActions={rightActions}
      accessibilityActions={[
        ...(finished
          ? []
          : [
              {
                name: 'pause',
                label: item.paused ? 'Resume' : 'Pause',
                run: () => onPause(item, !item.paused),
              },
            ]),
        { name: 'delete', label: 'Delete', run: () => onDelete(item) },
      ]}
      onPress={() => onPress(item)}
    />
  );
}

export const RecurringRow = memo(RecurringRowComponent);
