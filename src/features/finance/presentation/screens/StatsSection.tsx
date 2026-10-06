import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

import { EmptyState, SegmentedControl } from '@/components';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { STATS_MONTH_OPTIONS, type StatsMonths } from '../../domain/stats-usecases';
import { CashflowCard } from '../components/CashflowCard';
import { CategoryBreakdownCard } from '../components/CategoryBreakdownCard';
import { IncomeExpenseCard } from '../components/IncomeExpenseCard';
import { MonthComparisonCard } from '../components/MonthComparisonCard';
import { useCurrency } from '../queries';
import { useStatsViewModel } from '../view-models/useStatsViewModel';

const WIDE_MIN_WIDTH = 900;
const CONTENT_MAX_WIDTH = 1100;

const MONTH_OPTIONS = STATS_MONTH_OPTIONS.map((value) => {
  const { t } = useTranslator();
  return {
    value: String(value),
    label: t('{value} months', { value: value }),
  };
});

/** Income against expenses, spending by category, month on month and cashflow. */
export function StatsSection() {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const currency = useCurrency();
  const vm = useStatsViewModel();
  const { stats } = vm;
  const wide = width >= WIDE_MIN_WIDTH;

  const body = () => {
    if (stats === undefined) {
      return vm.isError ? (
        <EmptyState
          icon="error-outline"
          title={t("Couldn't load statistics")}
          message={t('Your data is safe on this device. Try again.')}
          actionLabel={t('Try again')}
          onAction={() => void vm.refetch()}
        />
      ) : (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel={t('Loading statistics')}
          style={{ marginTop: spacing.xxl }}
        />
      );
    }
    const cards = [
      <IncomeExpenseCard key="income" months={stats.months} currency={currency} />,
      <CashflowCard key="cashflow" points={stats.cashflow} currency={currency} />,
      <CategoryBreakdownCard
        key="categories"
        breakdown={vm.breakdown}
        onBreakdown={vm.setBreakdown}
        slices={stats.categories}
        totalMinor={stats.categoryTotalMinor}
        currency={currency}
      />,
      <MonthComparisonCard
        key="comparison"
        current={stats.comparison.current}
        previous={stats.comparison.previous}
        changes={stats.comparison.changes}
        breakdown={vm.breakdown}
        currency={currency}
      />,
    ];
    if (!wide) {
      return <View style={{ gap: spacing.md }}>{cards}</View>;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.md }}>{[cards[0], cards[2]]}</View>
        <View style={{ flex: 1, gap: spacing.md }}>{[cards[1], cards[3]]}</View>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{
        width: '100%',
        maxWidth: CONTENT_MAX_WIDTH,
        alignSelf: 'center',
        gap: spacing.md,
        padding: spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={vm.isRefreshing} onRefresh={() => void vm.refetch()} />
      }
    >
      <SegmentedControl
        options={MONTH_OPTIONS}
        value={String(vm.months)}
        onChange={(value) => vm.setMonths(Number(value) as StatsMonths)}
      />
      {body()}
    </ScrollView>
  );
}
