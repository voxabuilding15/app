import { PAGE_HEIGHT, PAGE_WIDTH, PdfDocument, type Rgb } from './pdf';
import type { Metric } from './report';
import { summarize, type Words } from './summary';
import type { StatsReport } from './usecases';

const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = PAGE_HEIGHT - 48;

const INK: Rgb = [0.11, 0.1, 0.13];
const MUTED: Rgb = [0.4, 0.38, 0.43];
const ACCENT: Rgb = [0.48, 0.18, 0.97];
const TRACK: Rgb = [0.92, 0.9, 0.95];

function periodTitle(report: StatsReport): string {
  const { from, to } = report.range;
  return from === to ? from : `${from}  –  ${to}`;
}

/** The report as a printable PDF: score tiles, a table per area, and one bar chart per metric. */
export function reportToPdf(report: StatsReport, words: Words): Uint8Array {
  const { t } = words;
  const doc = new PdfDocument();
  let y = 0;

  const newPage = () => {
    doc.addPage();
    y = MARGIN;
    doc.text(MARGIN, PAGE_HEIGHT - 24, 'FocusFlow', { size: 8, color: MUTED });
    doc.text(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 24, String(doc.pageCount), {
      size: 8,
      color: MUTED,
      alignRight: true,
    });
  };
  const room = (needed: number) => {
    if (y + needed > BOTTOM) {
      newPage();
    }
  };

  newPage();
  doc.text(MARGIN, y + 20, t('Statistics report'), { size: 22, bold: true });
  y += 40;
  doc.text(
    MARGIN,
    y,
    `${periodTitle(report)}   ·   ${t('compared with')} ${report.previousRange.from}`,
    {
      size: 10,
      color: MUTED,
    },
  );
  y += 28;

  const sections = summarize(report, words);
  const scores = sections[0];
  if (scores !== undefined) {
    const tile = (CONTENT_WIDTH - 3 * 10) / 4;
    scores.rows.forEach((row, index) => {
      const x = MARGIN + index * (tile + 10);
      doc.box(x, y, tile, 62, TRACK);
      doc.text(x + 10, y + 18, row.label, { size: 8, color: MUTED });
      doc.text(x + 10, y + 44, row.display, { size: 22, bold: true, color: ACCENT });
    });
    y += 82;
  }

  for (const section of sections.slice(1)) {
    room(30 + section.rows.length * 18);
    doc.text(MARGIN, y, section.title, { size: 13, bold: true });
    doc.text(PAGE_WIDTH - MARGIN - 110, y, t('This period'), {
      size: 8,
      color: MUTED,
      alignRight: true,
    });
    doc.text(PAGE_WIDTH - MARGIN, y, t('Previous'), { size: 8, color: MUTED, alignRight: true });
    y += 8;
    doc.rule(MARGIN, PAGE_WIDTH - MARGIN, y);
    y += 14;
    for (const row of section.rows) {
      doc.text(MARGIN, y, row.label, { size: 10, color: INK });
      doc.text(PAGE_WIDTH - MARGIN - 110, y, row.display, {
        size: 10,
        bold: true,
        alignRight: true,
      });
      doc.text(PAGE_WIDTH - MARGIN, y, row.previousDisplay, {
        size: 10,
        color: MUTED,
        alignRight: true,
      });
      y += 18;
    }
    y += 10;
  }

  if (report.finance.topCategories.length > 0) {
    room(30 + report.finance.topCategories.length * 18);
    doc.text(MARGIN, y, t('Spending by category'), { size: 13, bold: true });
    y += 18;
    for (const slice of report.finance.topCategories) {
      doc.text(MARGIN, y, slice.name, { size: 10 });
      doc.box(MARGIN + 170, y - 8, 240 * slice.share, 9, ACCENT);
      doc.text(PAGE_WIDTH - MARGIN, y, `${Math.round(slice.share * 100)}%`, {
        size: 10,
        alignRight: true,
      });
      y += 18;
    }
    y += 10;
  }

  const labels: Record<Metric, string> = {
    focus: t('Focus minutes'),
    tasks: t('Tasks completed'),
    habits: t('Habit check-ins'),
    events: t('Events'),
    notes: t('Notes created'),
  };
  const charts = (
    Object.entries(report.series) as [Metric, NonNullable<StatsReport['series'][Metric]>][]
  ).map(([metric, points]) => ({
    title: labels[metric],
    values: points.map((point) => point.value),
    keys: points.map((point) => point.bucket.key),
  }));
  charts.push({
    title: t('Spending'),
    values: report.spending.map((point) => point.value),
    keys: report.spending.map((point) => point.bucket.key),
  });

  const CHART_HEIGHT = 70;
  for (const chart of charts) {
    room(CHART_HEIGHT + 50);
    doc.text(MARGIN, y, chart.title, { size: 11, bold: true });
    y += 10;
    const peak = Math.max(1, ...chart.values);
    const slot = CONTENT_WIDTH / chart.values.length;
    chart.values.forEach((value, index) => {
      const height = (value / peak) * CHART_HEIGHT;
      doc.box(
        MARGIN + index * slot + slot * 0.15,
        y + CHART_HEIGHT - height,
        slot * 0.7,
        Math.max(height, value > 0 ? 1 : 0),
        ACCENT,
      );
    });
    doc.rule(MARGIN, PAGE_WIDTH - MARGIN, y + CHART_HEIGHT + 1);
    const every = Math.ceil(chart.values.length / 12);
    chart.keys.forEach((key, index) => {
      if (index % every === 0) {
        doc.text(MARGIN + index * slot, y + CHART_HEIGHT + 12, key.slice(-5), {
          size: 6.5,
          color: MUTED,
        });
      }
    });
    y += CHART_HEIGHT + 30;
  }

  return doc.build(
    t('FocusFlow {t} {periodTitle}', {
      t: t('Statistics report'),
      periodTitle: periodTitle(report),
    }),
  );
}
