import { Card, GroupedBarChart, Text } from '@/components';
import { formatMoney } from '@/core';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import type { CashflowPoint } from '../../domain/stats';
import { formatMonth } from '../format';

interface CashflowCardProps {
  points: readonly CashflowPoint[];
  currency: string;
}

function signed(minor: number, currency: string): string {
  return `${minor > 0 ? '+' : ''}${formatMoney(minor, currency)}`;
}

/** Net money in or out of each month: gains rise above the axis, losses fall below it. */
export function CashflowCard({ points, currency }: CashflowCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const total = points.at(-1)?.cumulativeMinor ?? 0;

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Cashflow')}
      </Text>
      <GroupedBarChart
        label={t('Net cashflow for the last {months} months', { months: points.length })}
        height={160}
        showLegend={false}
        series={[{ name: t('Net'), color: colors.success, negativeColor: colors.error }]}
        data={points.map((point) => ({
          label: formatMonth(point.month, 'short'),
          values: [point.netMinor],
          description: t('{month}: net {signed}', {
            month: formatMonth(point.month, 'long'),
            signed: signed(point.netMinor, currency),
          }),
        }))}
      />
      <Text
        variant="bodyMedium"
        style={{ color: total < 0 ? colors.error : colors.onSurface }}
        accessibilityLabel={t('Net over the period {signed}', { signed: signed(total, currency) })}
      >
        {t('Net over the period: {signed}', { signed: signed(total, currency) })}
      </Text>
    </Card>
  );
}
