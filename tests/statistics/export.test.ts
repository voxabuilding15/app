import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { escapePdfText, PdfDocument } from '@/features/statistics/domain/pdf';
import { reportToCsv } from '@/features/statistics/domain/export-csv';
import { reportToPdf } from '@/features/statistics/domain/export-pdf';
import { formatMinutes, summarize, weekdayName } from '@/features/statistics/domain/summary';

import { at, createStats, type StatsFixture } from './setup';

const words = { t: (text: string) => text, locale: 'en' };
const french = {
  t: (text: string) => (text === 'Statistics report' ? 'Rapport de statistiques' : text),
  locale: 'fr',
};
let s: StatsFixture;
beforeEach(() => {
  s = createStats(at(2026, 10, 15, 18));
});

async function seeded() {
  const food = s.addCategory('Food, "drinks"');
  s.addTask('t', {
    createdAt: at(2026, 10, 13),
    dueAt: at(2026, 10, 14),
    completedAt: at(2026, 10, 14),
  });
  s.addTransaction('income', 123_456, at(2026, 10, 12));
  s.addTransaction('expense', 2_550, at(2026, 10, 13), food);
  s.addEvent('Call', at(2026, 10, 14, 9), at(2026, 10, 14, 10, 30));
  await s.addFocus(at(2026, 10, 14, 9), 45, { deepFocus: 88 });
  return s.stats.report('week', '2026-10-15');
}

describe('summary rows', () => {
  it('formats durations and weekday names', () => {
    assert.equal(formatMinutes(0), '0m');
    assert.equal(formatMinutes(59.6), '1h');
    assert.equal(formatMinutes(125), '2h 5m');
    assert.equal(weekdayName(3, 'en'), 'Wednesday');
    assert.equal(weekdayName(0, 'fr'), 'dimanche');
  });

  it('gives each area its rows with the previous period beside them', async () => {
    const sections = summarize(await seeded(), words);
    assert.deepEqual(
      sections.map((section) => section.title),
      ['Scores', 'Tasks', 'Habits', 'Focus', 'Calendar', 'Finance', 'Notes'],
    );
    const focus = sections.find((section) => section.title === 'Focus')?.rows[0];
    assert.deepEqual([focus?.display, focus?.raw, focus?.previousDisplay], ['45m', 45, '0m']);
    const income = sections.find((section) => section.title === 'Finance')?.rows[0];
    assert.deepEqual([income?.raw, income?.display], [1234.56, '$1,234.56']);
    const empty = summarize(await createStats().stats.report('week', '2026-10-15'), words)[0];
    assert.deepEqual(
      empty?.rows.map((row) => [row.raw, row.display]),
      [
        [null, '–'],
        [null, '–'],
        [null, '–'],
        [null, '–'],
      ],
    );
  });
});

describe('CSV export', () => {
  it('writes the header, one row per figure and one per chart point, with CRLF line ends', async () => {
    const csv = reportToCsv(await seeded(), words);
    const lines = csv.split('\r\n');
    assert.equal(lines.at(-1), '');
    assert.equal(lines[0], 'Report,week');
    assert.equal(lines[1], 'From,2026-10-12');
    assert.equal(lines[2], 'To,2026-10-18');
    assert.ok(lines.includes('Section,Metric,Value,Previous period,Unit'));
    assert.ok(lines.includes('Focus,Focus time,45,0,minutes'));
    assert.ok(lines.includes('Finance,Income,1234.56,0,money'));
    assert.ok(lines.includes('Tasks,Completed,1,0,count'));
    assert.ok(lines.includes('Series,Period,Value'));
    assert.ok(lines.includes('Focus minutes,2026-10-14,45'));
    assert.ok(lines.includes('Spending,2026-10-13,25.5'));
    // Names with commas and quotes stay in one cell.
    assert.ok(lines.includes('Spending by category,"Food, ""drinks""",25.5,100'));
  });

  it('leaves figures without data empty instead of writing zero', async () => {
    const csv = reportToCsv(await createStats().stats.report('day', '2026-10-15'), words);
    assert.ok(csv.includes('Scores,Productivity score,,,score'));
  });

  it('labels hourly points by the hour', async () => {
    const day = await seeded().then(() => s.stats.report('day', '2026-10-14'));
    assert.ok(reportToCsv(day, words).includes('Focus minutes,09:00,45'));
  });
});

describe('PDF export', () => {
  const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

  it('writes a well-formed file whose cross-reference table points at every object', async () => {
    const pdf = text(reportToPdf(await seeded(), words));
    assert.ok(pdf.startsWith('%PDF-1.4'));
    assert.ok(pdf.trimEnd().endsWith('%%EOF'));
    const start = Number(/startxref\n(\d+)\n/.exec(pdf)?.[1]);
    assert.equal(pdf.slice(start, start + 4), 'xref');
    const entries = [...pdf.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((match) =>
      Number(match[1]),
    );
    assert.ok(entries.length >= 6);
    entries.forEach((offset, index) => {
      assert.ok(
        pdf.slice(offset).startsWith(`${index + 1} 0 obj`),
        `object ${index + 1} at ${offset}`,
      );
    });
    const size = Number(/\/Size (\d+)/.exec(pdf)?.[1]);
    assert.equal(size, entries.length + 1);
  });

  it('declares stream lengths that match their content', async () => {
    const pdf = text(reportToPdf(await seeded(), words));
    for (const match of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      assert.equal(Number(match[1]), match[2]?.length);
    }
  });

  it('shows the figures and charts', async () => {
    const pdf = text(reportToPdf(await seeded(), words));
    for (const label of [
      'Statistics report',
      'Productivity score',
      'Task completion rate',
      'Focus time',
      '45m',
      'Spending by category',
      'Focus minutes',
    ]) {
      assert.ok(pdf.includes(`(${label})`), label);
    }
    assert.ok(/\/Count [1-9]/.test(pdf));
  });

  it('translates and keeps accented letters', async () => {
    const pdf = text(reportToPdf(await seeded(), french));
    assert.ok(pdf.includes('(Rapport de statistiques)'));
    assert.equal(escapePdfText('Café (été) \\ 日本'), 'Caf\\351 \\(\\351t\\351\\) \\\\ ??');
  });

  it('adds pages when the content does not fit, and refuses to draw without one', () => {
    const doc = new PdfDocument();
    assert.throws(() => doc.text(0, 0, 'x'));
    doc.addPage();
    doc.addPage();
    const pdf = text(doc.build('Two'));
    assert.ok(pdf.includes('/Count 2'));
    assert.ok(pdf.includes('/Title (Two)'));
  });
});

describe('export use case', () => {
  it('saves the file under exports, shares it and reports whether anything could open it', async () => {
    const report = await seeded();
    const csv = await s.exports.exportReport(report, 'csv', words);
    assert.match(csv.file.path, /^exports\/focusflow-week-2026-10-12-\d{8}T\d{6}\.csv$/);
    assert.equal(csv.shared, true);
    assert.equal(s.files.shared[0]?.mimeType, 'text/csv');
    assert.ok((await s.files.readText('cache', csv.file.path)).startsWith('Report,week'));

    s.files.canShare = false;
    const pdf = await s.exports.exportReport(report, 'pdf', words);
    assert.equal(pdf.shared, false);
    assert.ok(pdf.file.sizeBytes > 500);
  });

  it('keeps only the most recent exports', async () => {
    const report = await seeded();
    for (let index = 0; index < 13; index += 1) {
      s.state.now += 1000;
      await s.exports.exportReport(report, 'csv', words);
    }
    assert.equal((await s.files.list('cache', 'exports')).length, 10);
  });
});
