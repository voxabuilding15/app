import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, ScreenToolbar, SegmentedControl, Snackbar, Text } from '@/components';
import { LevelProgressCard } from '@/features/achievements';
import { useIsTablet } from '@/hooks';
import { useTranslator } from '@/i18n';
import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';

import { STATS_PERIODS, type StatsPeriod } from '../../domain/range';
import { ScoresCard } from '../components/ScoresCard';
import { SummaryCards } from '../components/SummaryCards';
import { TrendCard } from '../components/TrendCard';
import { periodTitle } from '../format';
import { useStatisticsViewModel } from '../view-models/useStatisticsViewModel';

const WIDE_MAX_WIDTH = 1280;

/** Statistics across the whole app: scores, trends, a card per area, and CSV or PDF export. */
export function StatisticsScreen() {
  const vm = useStatisticsViewModel();
  const { t, locale } = useTranslator();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const router = useRouter();

  const periods: readonly { value: StatsPeriod; label: string }[] = STATS_PERIODS.map((value) => ({
    value,
    label: { day: t('Day'), week: t('Week'), month: t('Month'), year: t('Year') }[value],
  }));
  const { report } = vm;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Statistics')}>
        <IconButton
          icon="table-chart"
          label={t('Export as CSV')}
          disabled={report === undefined || vm.exporting !== null}
          onPress={() => void vm.exportReport('csv')}
        />
        <IconButton
          icon="picture-as-pdf"
          label={t('Export as PDF')}
          disabled={report === undefined || vm.exporting !== null}
          onPress={() => void vm.exportReport('pdf')}
        />
      </ScreenToolbar>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          width: '100%',
          maxWidth: isTablet ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
      >
        <SegmentedControl options={periods} value={vm.period} onChange={vm.setPeriod} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <IconButton
            icon="chevron-left"
            label={t('Previous {period}', {
              period: periods.find((p) => p.value === vm.period)?.label.toLowerCase() ?? '',
            })}
            onPress={vm.goPrevious}
          />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleMedium" accessibilityRole="header" style={{ textAlign: 'center' }}>
              {report === undefined ? ' ' : periodTitle(vm.period, report.range, locale)}
            </Text>
          </View>
          <IconButton
            icon="chevron-right"
            label={t('Next {period}', {
              period: periods.find((p) => p.value === vm.period)?.label.toLowerCase() ?? '',
            })}
            disabled={!vm.canGoNext}
            onPress={vm.goNext}
          />
        </View>
        {vm.isCurrent ? null : (
          <Button label={t('Back to today')} variant="text" onPress={vm.goToday} />
        )}

        {vm.isError && report === undefined ? (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Text tone="error">{t("Couldn't load your statistics.")}</Text>
            <Button label={t('Try again')} variant="tonal" onPress={() => void vm.refetch()} />
          </View>
        ) : report === undefined ? null : isTablet ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: spacing.lg }}>
              <LevelProgressCard onPress={() => router.navigate('/achievements')} />
              <ScoresCard report={report} />
              <TrendCard vm={vm} report={report} />
            </View>
            <View style={{ flex: 1 }}>
              <SummaryCards report={report} />
            </View>
          </View>
        ) : (
          <>
            <LevelProgressCard onPress={() => router.navigate('/achievements')} />
            <ScoresCard report={report} />
            <TrendCard vm={vm} report={report} />
            <SummaryCards report={report} />
          </>
        )}
      </ScrollView>
      {vm.notice ? <Snackbar message={vm.notice.message} onDismiss={vm.dismissNotice} /> : null}
    </View>
  );
}
