import { View } from 'react-native';

import { Card, Icon, Text } from '@/components';
import { formatMoney } from '@/core';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { CategoryChange, MonthTotals } from '../../domain/stats';
import { percentChange } from '../../domain/stats';
import type { Breakdown } from '../../domain/stats-usecases';
import { formatMonth } from '../format';

const MAX_CHANGES = 5;

interface MonthComparisonCardProps {
  current: MonthTotals;
  previous: MonthTotals;
  changes: readonly CategoryChange[];
  breakdown: Breakdown;
  currency: string;
}

function describePercent(change: number | null): string {
  if (change === null) {
    return 'new';
  }
  const rounded = Math.round(change * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

interface TotalRowProps {
  label: string;
  current: number;
  previous: number;
  currency: string;
  /** Whether an increase is good news (income) or bad (expenses). */
  higherIsBetter: boolean;
}

function TotalRow({ label, current, previous, currency, higherIsBetter }: TotalRowProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const change = percentChange(current, previous);
  const better = current === previous ? null : current > previous === higherIsBetter;
  const color = better === null ? colors.onSurfaceVariant : better ? colors.success : colors.error;

  return (
    <View
      accessible
      accessibilityLabel={
        change === null
          ? t('{label}: {current} this month, {previous} last month', {
              label,
              current: formatMoney(current, currency),
              previous: formatMoney(previous, currency),
            })
          : t('{label}: {current} this month, {previous} last month, {change}', {
              label,
              current: formatMoney(current, currency),
              previous: formatMoney(previous, currency),
              change: describePercent(change),
            })
      }
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <Text variant="bodyMedium" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="labelSmall" tone="muted">
        {formatMoney(previous, currency)}
      </Text>
      <Icon name="arrow-forward" size={14} />
      <Text variant="labelLarge">{formatMoney(current, currency)}</Text>
      <Text variant="labelSmall" style={{ color, minWidth: 44, textAlign: 'right' }}>
        {change === null ? '' : describePercent(change)}
      </Text>
    </View>
  );
}

/** This month against last month: the totals and the categories that moved the most. */
export function MonthComparisonCard({
  current,
  previous,
  changes,
  breakdown,
  currency,
}: MonthComparisonCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const visible = changes.filter((change) => change.deltaMinor !== 0).slice(0, MAX_CHANGES);
  const noun = breakdown === 'expense' ? 'spending' : 'income';

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {`${formatMonth(current.month, 'short')} vs ${formatMonth(previous.month, 'short')}`}
      </Text>
      <TotalRow
        label={t('Income')}
        current={current.incomeMinor}
        previous={previous.incomeMinor}
        currency={currency}
        higherIsBetter
      />
      <TotalRow
        label={t('Expenses')}
        current={current.expenseMinor}
        previous={previous.expenseMinor}
        currency={currency}
        higherIsBetter={false}
      />
      <TotalRow
        label={t('Net')}
        current={current.incomeMinor - current.expenseMinor}
        previous={previous.incomeMinor - previous.expenseMinor}
        currency={currency}
        higherIsBetter
      />
      <Text variant="labelLarge" accessibilityRole="header">
        {t('Biggest changes in {noun}', { noun })}
      </Text>
      {visible.length === 0 ? (
        <Text tone="muted">{t('No change in {noun} between these months.', { noun })}</Text>
      ) : (
        visible.map((change) => {
          const up = change.deltaMinor > 0;
          // More spending is worse; more income is better.
          const good = up === (breakdown === 'income');
          return (
            <View
              key={change.id ?? change.name}
              accessible
              accessibilityLabel={`${change.name}: ${up ? 'up' : 'down'} ${formatMoney(Math.abs(change.deltaMinor), currency)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: change.color }}
              />
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                {change.name}
              </Text>
              <Icon
                name={up ? 'trending-up' : 'trending-down'}
                size={18}
                color={good ? colors.success : colors.error}
              />
              <Text variant="labelLarge" style={{ color: good ? colors.success : colors.error }}>
                {`${up ? '+' : '-'}${formatMoney(Math.abs(change.deltaMinor), currency)}`}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}
