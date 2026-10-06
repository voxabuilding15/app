import { View } from 'react-native';

import { BarChart, Card, Chip, Text, WRAP_ROW } from '@/components';
import { formatMoney } from '@/core';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import type { Metric, SeriesPoint } from '../../domain/report';
import { formatMinutes } from '../../domain/summary';
import type { StatsReport } from '../../domain/usecases';
import { bucketAxisLabel, bucketName } from '../format';
import type { ChartMetric, StatisticsViewModel } from '../view-models/useStatisticsViewModel';

function pointsFor(report: StatsReport, metric: ChartMetric): SeriesPoint[] {
  return metric === 'spending' ? report.spending : (report.series[metric as Metric] ?? []);
}

/** Interactive chart: pick a metric, tap a bar to read its exact value. */
export function TrendCard({ vm, report }: { vm: StatisticsViewModel; report: StatsReport }) {
  const { t, tn, locale } = useTranslator();

  const names: Record<ChartMetric, string> = {
    focus: t('Focus'),
    tasks: t('Tasks'),
    habits: t('Habits'),
    events: t('Events'),
    notes: t('Notes'),
    spending: t('Spending'),
  };
  const show = (metric: ChartMetric, value: number): string => {
    switch (metric) {
      case 'focus':
        return formatMinutes(value);
      case 'spending':
        return formatMoney(value, report.currency);
      case 'tasks':
        return tn(value, '{count} task completed', '{count} tasks completed');
      case 'habits':
        return tn(value, '{count} check-in', '{count} check-ins');
      case 'events':
        return tn(value, '{count} event', '{count} events');
      default:
        return tn(value, '{count} note written', '{count} notes written');
    }
  };

  const points = pointsFor(report, vm.metric);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const picked = vm.selected === null ? null : (points[vm.selected] ?? null);

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {t('Trends')}
      </Text>
      <View style={WRAP_ROW}>
        {vm.metrics.map((metric) => (
          <Chip
            key={metric}
            label={names[metric]}
            selected={metric === vm.metric}
            onPress={() => vm.setMetric(metric)}
          />
        ))}
      </View>
      <BarChart
        label={`${names[vm.metric]} · ${t('tap a bar for details')}`}
        height={150}
        selectedIndex={vm.selected}
        onSelect={vm.select}
        data={points.map((point) => ({
          label: bucketAxisLabel(report.period, point.bucket.key, locale),
          value: point.value,
          description: `${bucketName(report.period, point.bucket.key, locale)}: ${show(vm.metric, point.value)}`,
        }))}
      />
      <View accessibilityLiveRegion="polite">
        <Text variant="labelLarge">
          {picked === null
            ? `${t('Total')}: ${show(vm.metric, total)}`
            : `${bucketName(report.period, picked.bucket.key, locale)}: ${show(vm.metric, picked.value)}`}
        </Text>
      </View>
    </Card>
  );
}
