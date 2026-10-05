import type { RangePreset, TransactionSortField } from '../domain/filters';
import { TRANSACTION_TYPES } from '../domain/entities';

import { TRANSACTION_TYPE_LABEL } from './format';

export const RANGE_OPTIONS: readonly { value: RangePreset; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'year', label: 'This year' },
];

export const TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));

export const SORT_FIELDS: readonly TransactionSortField[] = ['date', 'amount'];

export function sortLabel(field: TransactionSortField): string {
  return field === 'date' ? 'Date' : 'Amount';
}
