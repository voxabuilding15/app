import { describeRecurrence, type IconName } from '@/components';
import { dateKeyToNoon, formatMoney, startOfDay, type DateKey } from '@/core';

import type {
  AccountType,
  BudgetPeriod,
  BudgetProgress,
  RecurringTransaction,
  Transaction,
  TransactionType,
} from '../domain/entities';
import { msg } from '@/i18n/msg';
import { currentTranslator } from '@/i18n/translate';
import { appLocale } from '@/i18n/formatting';

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  expense: msg('Expense'),
  income: msg('Income'),
  transfer: msg('Transfer'),
};

export const TRANSACTION_TYPE_ICON: Record<TransactionType, IconName> = {
  expense: 'arrow-upward',
  income: 'arrow-downward',
  transfer: 'swap-horiz',
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: msg('Cash'),
  bank: msg('Bank'),
  savings: msg('Savings'),
  credit_card: msg('Credit card'),
};

export const ACCOUNT_TYPE_ICON: Record<AccountType, IconName> = {
  cash: 'payments',
  bank: 'account-balance',
  savings: 'savings',
  credit_card: 'credit-card',
};

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = {
  monthly: msg('Monthly'),
  weekly: msg('Weekly'),
  custom: msg('Custom'),
};

export function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString(appLocale(), { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday" or a short date such as "Mon, 5 Oct" (with the year when it is not this one). */
export function formatDate(at: number, now: number): string {
  const { t } = currentTranslator();
  const today = startOfDay(now);
  const day = startOfDay(at);
  if (day === today) {
    return t('Today');
  }
  if (day === startOfDay(today - 12 * 3_600_000)) {
    return t('Yesterday');
  }
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString(appLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

/** "5 Oct 2026" for a day key. */
export function formatDayKey(key: DateKey): string {
  return new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Oct" or "October 2026" for a 'YYYY-MM' month. */
export function formatMonth(month: string, style: 'short' | 'long'): string {
  const noon = dateKeyToNoon(`${month}-01`);
  return new Date(noon).toLocaleDateString(
    appLocale(),
    style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' },
  );
}

/** "5 Oct – 11 Oct" for the days a budget covers. */
export function formatDayRange(from: DateKey, to: DateKey): string {
  const short = (key: DateKey) =>
    new Date(dateKeyToNoon(key)).toLocaleDateString(appLocale(), {
      day: 'numeric',
      month: 'short',
    });
  return from === to ? short(from) : `${short(from)} – ${short(to)}`;
}

/** Signed amount: "+$5.00" for income, "-$5.00" for an expense, "$5.00" for a transfer. */
export function formatSignedAmount(
  type: TransactionType,
  amountMinor: number,
  currency: string,
): string {
  const text = formatMoney(amountMinor, currency);
  switch (type) {
    case 'income':
      return `+${text}`;
    case 'expense':
      return `-${text}`;
    default:
      return text;
  }
}

/** Where the money moved: the account, or "Cash → Bank" for a transfer. */
export function describeFlow(item: Pick<Transaction, 'account' | 'toAccount'>): string {
  return item.toAccount === null
    ? item.account.name
    : `${item.account.name} → ${item.toAccount.name}`;
}

/** Accessible one-sentence summary of a transaction for screen readers. */
export function describeTransaction(item: Transaction, now: number, currency: string): string {
  const { t } = currentTranslator();
  const parts = [
    `${TRANSACTION_TYPE_LABEL[item.type]} ${formatMoney(item.amountMinor, currency)}`,
    item.category?.name ?? (item.type === 'transfer' ? null : t('no category')),
    describeFlow(item),
    `${formatDate(item.occurredAt, now)}, ${formatTime(item.occurredAt)}`,
    item.note || null,
    item.recurringId === null ? null : 'repeating',
  ];
  return parts.filter(Boolean).join(', ');
}

const BUDGET_KIND: Record<string, string> = {
  monthly: msg('Monthly budget'),
  weekly: msg('Weekly budget'),
  custom: msg('Custom budget'),
};

export function describeBudget(progress: BudgetProgress, currency: string): string {
  const { t } = currentTranslator();
  const { budget, spentMinor, remainingMinor } = progress;
  const standing =
    remainingMinor < 0
      ? t('over by {money}', { money: formatMoney(-remainingMinor, currency) })
      : t('{money} left', { money: formatMoney(remainingMinor, currency) });
  return [
    budget.name,
    t(BUDGET_KIND[budget.period]),
    t('{spent} of {limit} spent', {
      spent: formatMoney(spentMinor, currency),
      limit: formatMoney(budget.amountMinor, currency),
    }),
    standing,
  ].join(', ');
}

/** "Monthly · next 5 Nov" style summary of a recurring rule. */
export function describeSchedule(
  item: Pick<RecurringTransaction, 'rule' | 'nextDate' | 'paused' | 'endDate'>,
): string {
  const parts: string[] = [describeRecurrence(item.rule)];
  if (item.paused) {
    parts.push('paused');
  } else if (item.nextDate === null) {
    parts.push('finished');
  } else {
    parts.push(`next ${formatDayKey(item.nextDate)}`);
  }
  return parts.join(' · ');
}

export function describeRecurring(item: RecurringTransaction, currency: string): string {
  return [
    `${TRANSACTION_TYPE_LABEL[item.type]} ${formatMoney(item.amountMinor, currency)}`,
    item.note || item.category?.name || null,
    describeFlow(item),
    describeSchedule(item),
  ]
    .filter(Boolean)
    .join(', ');
}
