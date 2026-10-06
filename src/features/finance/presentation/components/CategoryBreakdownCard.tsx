import { View } from 'react-native';

import { Card, DonutChart, SegmentedControl, Text } from '@/components';
import { formatMoney } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { CategorySlice } from '../../domain/stats';
import type { Breakdown } from '../../domain/stats-usecases';
import { msg } from '@/i18n/msg';

const BREAKDOWN_OPTIONS = [
  { value: 'expense', label: msg('Spending') },
  { value: 'income', label: msg('Income') },
] as const satisfies readonly { value: Breakdown; label: string }[];

interface CategoryBreakdownCardProps {
  breakdown: Breakdown;
  onBreakdown: (breakdown: Breakdown) => void;
  slices: readonly CategorySlice[];
  totalMinor: number;
  currency: string;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Where the money went (or came from), by category. */
export function CategoryBreakdownCard({
  breakdown,
  onBreakdown,
  slices,
  totalMinor,
  currency,
}: CategoryBreakdownCardProps) {
  const { t } = useTranslator();
  const noun = breakdown === 'expense' ? t('Spending') : t('Income');

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('By category')}
      </Text>
      <SegmentedControl options={BREAKDOWN_OPTIONS} value={breakdown} onChange={onBreakdown} />
      {slices.length === 0 ? (
        <Text tone="muted">
          {t('No {lowerCase} in this period.', { lowerCase: noun.toLowerCase() })}
        </Text>
      ) : (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xl }}
        >
          <DonutChart
            slices={slices.map((slice) => ({
              key: slice.id ?? slice.name,
              value: slice.totalMinor,
              color: slice.color,
            }))}
            label={t('{noun} by category: {join}', {
              noun: noun,
              join: slices.map((slice) => `${slice.name} ${percent(slice.share)}`).join(', '),
            })}
          >
            <Text variant="labelSmall" tone="muted">
              {t('Total')}
            </Text>
            <Text variant="titleMedium">{formatMoney(totalMinor, currency)}</Text>
          </DonutChart>
          <View style={{ flex: 1, minWidth: 200, gap: spacing.sm }}>
            {slices.map((slice) => (
              <View
                key={slice.id ?? slice.name}
                accessible
                accessibilityLabel={`${slice.name}, ${formatMoney(slice.totalMinor, currency)}, ${percent(slice.share)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              >
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: slice.color }}
                />
                <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
                  {slice.name}
                </Text>
                <Text variant="labelSmall" tone="muted">
                  {percent(slice.share)}
                </Text>
                <Text variant="labelLarge">{formatMoney(slice.totalMinor, currency)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}
