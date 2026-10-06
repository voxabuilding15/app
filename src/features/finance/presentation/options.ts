import type { RangePreset, TransactionSortField } from '../domain/filters';
import { TRANSACTION_TYPES } from '../domain/entities';

import { TRANSACTION_TYPE_LABEL } from './format';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';

export const RANGE_OPTIONS: readonly { value: RangePreset; label: string }[] = [
  { value: 'all', label: msg('Any time') },
  { value: 'today', label: msg('Today') },
  { value: 'week', label: msg('This week') },
  { value: 'month', label: msg('This month') },
  { value: 'lastMonth', label: msg('Last month') },
  { value: 'year', label: msg('This year') },
];

export const TYPE_OPTIONS = TRANSACTION_TYPES.map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));

export const SORT_FIELDS: readonly TransactionSortField[] = ['date', 'amount'];

export function sortLabel(field: TransactionSortField): string {
  const { t } = currentTranslator();
  return field === 'date' ? t('Date') : t('Amount');
}
