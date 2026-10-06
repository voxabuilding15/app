import { toAmountText } from '@/core';

import { summarize, type Words } from './summary';
import type { Metric } from './report';
import type { StatsReport } from './usecases';

function cell(value: string | number | null): string {
  if (value === null) {
    return '';
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const line = (...values: (string | number | null)[]) => values.map(cell).join(',');

/** The bucket's start: an hour of the day, a date or a month. */
function bucketLabel(period: StatsReport['period'], key: string): string {
  if (period !== 'day') {
    return key;
  }
  return `${key.padStart(2, '0')}:00`;
}

/**
 * A spreadsheet-friendly export: the headline figures with the previous period beside them, then
 * one row per chart point. Numbers are plain (money in major units) so they sort and sum.
 */
export function reportToCsv(report: StatsReport, words: Words): string {
  const { t } = words;
  const seriesLabels: Record<Metric, string> = {
    focus: t('Focus minutes'),
    tasks: t('Tasks completed'),
    habits: t('Habit check-ins'),
    events: t('Events'),
    notes: t('Notes created'),
  };
  const lines: string[] = [
    line(t('Report'), report.period),
    line(t('From'), report.range.from),
    line(t('To'), report.range.to),
    line(t('Compared with'), `${report.previousRange.from} / ${report.previousRange.to}`),
    line(t('Currency'), report.currency),
    line(t('Generated'), new Date(report.generatedAt).toISOString()),
    '',
    line(t('Section'), t('Metric'), t('Value'), t('Previous period'), t('Unit')),
  ];
  for (const section of summarize(report, words)) {
    for (const row of section.rows) {
      lines.push(line(section.title, row.label, row.raw, row.previousRaw, row.unit));
    }
  }

  lines.push('', line(t('Series'), t('Period'), t('Value')));
  const series = Object.entries(report.series) as [
    Metric,
    NonNullable<StatsReport['series'][Metric]>,
  ][];
  for (const [metric, points] of series) {
    for (const point of points) {
      lines.push(
        line(seriesLabels[metric], bucketLabel(report.period, point.bucket.key), point.value),
      );
    }
  }
  for (const point of report.spending) {
    lines.push(
      line(
        t('Spending'),
        bucketLabel(report.period, point.bucket.key),
        Number(toAmountText(point.value, report.currency, true)),
      ),
    );
  }

  if (report.finance.topCategories.length > 0) {
    lines.push('', line(t('Spending by category'), t('Category'), t('Amount'), t('Share')));
    for (const slice of report.finance.topCategories) {
      lines.push(
        line(
          t('Spending by category'),
          slice.name,
          Number(toAmountText(slice.totalMinor, report.currency, true)),
          Math.round(slice.share * 100),
        ),
      );
    }
  }
  // CRLF is what spreadsheets expect.
  return `${lines.join('\r\n')}\r\n`;
}
