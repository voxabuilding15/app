import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bucketsFor,
  dayCount,
  periodRange,
  previousRange,
  shiftAnchor,
  toSpan,
} from '@/features/statistics/domain/range';

describe('period ranges', () => {
  it('finds the day, week (Monday first), month and year around a date', () => {
    assert.deepEqual(periodRange('day', '2026-10-15'), { from: '2026-10-15', to: '2026-10-15' });
    assert.deepEqual(periodRange('week', '2026-10-15'), { from: '2026-10-12', to: '2026-10-18' });
    assert.deepEqual(periodRange('week', '2026-10-18'), { from: '2026-10-12', to: '2026-10-18' });
    assert.deepEqual(periodRange('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(periodRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
    assert.deepEqual(periodRange('year', '2026-10-15'), { from: '2026-01-01', to: '2026-12-31' });
  });

  it('steps back and forward by whole periods, across month and year ends', () => {
    assert.equal(shiftAnchor('day', '2026-03-01', -1), '2026-02-28');
    assert.equal(shiftAnchor('week', '2026-10-15', 1), '2026-10-22');
    assert.equal(shiftAnchor('month', '2026-03-31', -1), '2026-02-01');
    assert.equal(shiftAnchor('month', '2026-01-15', -1), '2025-12-01');
    assert.equal(shiftAnchor('year', '2026-10-15', -1), '2025-10-01');
    assert.deepEqual(previousRange('month', '2026-03-31'), {
      from: '2026-02-01',
      to: '2026-02-28',
    });
    assert.deepEqual(previousRange('year', '2026-06-01'), { from: '2025-01-01', to: '2025-12-31' });
  });

  it('counts days and turns a day range into instants', () => {
    assert.equal(dayCount({ from: '2026-10-12', to: '2026-10-18' }), 7);
    const span = toSpan({ from: '2026-10-15', to: '2026-10-15' });
    assert.equal(span.to - span.from >= 23 * 3_600_000, true);
    assert.equal(new Date(span.from).getHours(), 0);
  });
});

describe('chart buckets', () => {
  it('cuts a day into hours, a week and month into days, a year into months', () => {
    assert.equal(bucketsFor('day', '2026-10-15').length, 24);
    assert.equal(bucketsFor('week', '2026-10-15').length, 7);
    assert.equal(bucketsFor('month', '2026-10-15').length, 31);
    assert.equal(bucketsFor('month', '2026-02-15').length, 28);
    const year = bucketsFor('year', '2026-10-15');
    assert.equal(year.length, 12);
    assert.equal(year[1]?.days.to, '2026-02-28');
  });

  it('covers the period without gaps or overlaps', () => {
    for (const period of ['day', 'week', 'month', 'year'] as const) {
      const buckets = bucketsFor(period, '2026-03-29');
      const whole = toSpan(
        period === 'day'
          ? { from: '2026-03-29', to: '2026-03-29' }
          : { from: buckets[0]!.days.from, to: buckets.at(-1)!.days.to },
      );
      assert.equal(buckets[0]?.span.from, whole.from);
      assert.equal(buckets.at(-1)?.span.to, whole.to);
      for (let index = 1; index < buckets.length; index += 1) {
        assert.equal(buckets[index]!.span.from, buckets[index - 1]!.span.to);
      }
    }
  });
});
