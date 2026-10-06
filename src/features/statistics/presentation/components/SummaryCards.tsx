import { View } from 'react-native';

import { Card, ChartLegend, DonutChart, Text } from '@/components';
import { formatMoney } from '@/core';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { summarize } from '../../domain/summary';
import type { StatsReport } from '../../domain/usecases';

function SpendingBreakdown({ report }: { report: StatsReport }) {
  const { t } = useTranslator();
  const { topCategories } = report.finance;
  if (topCategories.length === 0) {
    return null;
  }
  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <DonutChart
        size={150}
        strokeWidth={20}
        label={`${t('Spending by category')}: ${topCategories
          .map((slice) => `${slice.name} ${Math.round(slice.share * 100)}%`)
          .join(', ')}`}
        slices={topCategories.map((slice) => ({
          key: slice.id ?? slice.name,
          value: slice.totalMinor,
          color: slice.color,
        }))}
      >
        <Text variant="labelLarge">
          {formatMoney(report.finance.expenseMinor, report.currency)}
        </Text>
      </DonutChart>
      <ChartLegend
        items={topCategories.map((slice) => ({
          label: `${slice.name} · ${Math.round(slice.share * 100)}%`,
          color: slice.color,
        }))}
      />
    </View>
  );
}

/** One card per area of the app, each figure shown beside the previous period. */
export function SummaryCards({ report }: { report: StatsReport }) {
  const { t, locale } = useTranslator();
  // The scores have their own card above.
  const sections = summarize(report, { t, locale }).slice(1);
  const previous = t('Previous');

  return (
    <View style={{ gap: spacing.lg }}>
      {sections.map((section) => (
        <Card key={section.title} style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {section.title}
          </Text>
          {section.rows.map((row) => (
            <View
              key={row.label}
              accessible
              accessibilityLabel={`${row.label}: ${row.display}, ${previous.toLowerCase()}: ${row.previousDisplay}`}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}
            >
              <Text style={{ flex: 1 }}>{row.label}</Text>
              <Text variant="titleMedium">{row.display}</Text>
              <Text variant="labelSmall" tone="muted" style={{ minWidth: 64, textAlign: 'right' }}>
                {row.previousDisplay}
              </Text>
            </View>
          ))}
          {section.title === t('Finance') ? <SpendingBreakdown report={report} /> : null}
        </Card>
      ))}
    </View>
  );
}
