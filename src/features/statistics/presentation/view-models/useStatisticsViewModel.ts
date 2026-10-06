import { useCallback, useMemo, useState } from 'react';

import { toDateKey, useContainer, type DateKey } from '@/core';
import { useNotice } from '@/hooks';
import { LANGUAGE_INFO, translatorFor, useTranslator } from '@/i18n';

import type { ExportFormat } from '../../domain/export-usecases';
import { periodRange, shiftAnchor, type StatsPeriod } from '../../domain/range';
import type { Metric } from '../../domain/report';
import { metricsFor } from '../../domain/report';
import { useStatisticsModule } from '../module';
import { useReport } from '../queries';

export type ChartMetric = Metric | 'spending';

export function useStatisticsViewModel() {
  const { clock } = useContainer();
  const { exports } = useStatisticsModule();
  const { t, locale, language } = useTranslator();
  const { notice, show, dismiss } = useNotice();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const [anchor, setAnchor] = useState<DateKey>(() => toDateKey(clock.now()));
  const [metric, setMetric] = useState<ChartMetric>('focus');
  const [selected, setSelected] = useState<number | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const query = useReport(period, anchor);

  const today = toDateKey(clock.now());
  const nextStarts = periodRange(period, shiftAnchor(period, anchor, 1)).from;
  const metrics = useMemo<ChartMetric[]>(() => [...metricsFor(period), 'spending'], [period]);

  const changePeriod = useCallback((next: StatsPeriod) => {
    setPeriod(next);
    setSelected(null);
  }, []);

  const move = useCallback(
    (steps: number) => {
      setAnchor((current) => shiftAnchor(period, current, steps));
      setSelected(null);
    },
    [period],
  );

  const exportReport = useCallback(
    async (format: ExportFormat) => {
      const report = query.data;
      if (report === undefined || exporting !== null) {
        return;
      }
      setExporting(format);
      try {
        // The PDF's built-in fonts only have Latin letters, so it is written in English otherwise.
        const inEnglish = format === 'pdf' && !LANGUAGE_INFO[language].latin;
        const words = inEnglish ? translatorFor('en') : { t, locale };
        const result = await exports.exportReport(report, format, words);
        show({
          message: !result.shared
            ? t('Report saved, but no app can open it on this device')
            : inEnglish
              ? t('Report exported in English, because PDF reports cannot show this language yet')
              : t('Report exported'),
        });
      } catch {
        show({ message: t("Couldn't export the report. Try again.") });
      } finally {
        setExporting(null);
      }
    },
    [query.data, exporting, exports, t, locale, language, show],
  );

  return {
    report: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    period,
    setPeriod: changePeriod,
    anchor,
    goPrevious: () => move(-1),
    goNext: () => move(1),
    goToday: () => {
      setAnchor(today);
      setSelected(null);
    },
    isCurrent: periodRange(period, anchor).to >= today && periodRange(period, anchor).from <= today,
    canGoNext: nextStarts <= today,
    metric: metrics.includes(metric) ? metric : (metrics[0] ?? 'focus'),
    metrics,
    setMetric: (next: ChartMetric) => {
      setMetric(next);
      setSelected(null);
    },
    selected,
    select: setSelected,
    exporting,
    exportReport,
    notice,
    dismissNotice: dismiss,
  };
}

export type StatisticsViewModel = ReturnType<typeof useStatisticsViewModel>;
