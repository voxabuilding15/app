import { View } from 'react-native';

import { Card, GroupedBarChart, Text } from '@/components';
import { formatMoney } from '@/core';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { MonthTotals } from '../../domain/stats';
import { formatMonth } from '../format';

interface IncomeExpenseCardProps {
  months: readonly MonthTotals[];
  currency: string;
}

/** Income against expenses for each month, with the totals over the period underneath. */
export function IncomeExpenseCard({ months, currency }: IncomeExpenseCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const income = months.reduce((sum, month) => sum + month.incomeMinor, 0);
  const expenses = months.reduce((sum, month) => sum + month.expenseMinor, 0);

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Income vs expenses')}
      </Text>
      <GroupedBarChart
        label={t('Income and expenses for the last {length} months', { length: months.length })}
        height={160}
        series={[
          { name: 'Income', color: colors.success },
          { name: 'Expenses', color: colors.error },
        ]}
        data={months.map((month) => ({
          label: formatMonth(month.month, 'short'),
          values: [month.incomeMinor, month.expenseMinor],
          description: t('{month}: income {income}, expenses {expenses}', {
            month: formatMonth(month.month, 'long'),
            income: formatMoney(month.incomeMinor, currency),
            expenses: formatMoney(month.expenseMinor, currency),
          }),
        }))}
      />
      <View style={{ flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' }}>
        <View
          accessible
          accessibilityLabel={t('Total income {money}', { money: formatMoney(income, currency) })}
        >
          <Text variant="labelSmall" tone="muted">
            {t('Income')}
          </Text>
          <Text variant="titleMedium" style={{ color: colors.success }}>
            {formatMoney(income, currency)}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={t('Total expenses {money}', {
            money: formatMoney(expenses, currency),
          })}
        >
          <Text variant="labelSmall" tone="muted">
            {t('Expenses')}
          </Text>
          <Text variant="titleMedium" style={{ color: colors.error }}>
            {formatMoney(expenses, currency)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
