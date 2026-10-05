import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addDaysToKey, weekdayBit, type DateKey } from '@/core';
import type { HabitLog, HabitPause, HabitPeriod } from '@/features/habits/domain/entities';
import { nextUnit, previousUnit, unitKeyOf, unitRange } from '@/features/habits/domain/periods';
import { createEvaluator, summarize } from '@/features/habits/domain/progress';
import {
  ALL_WEEKDAYS,
  frequencyForPreset,
  isScheduledOn,
  presetOf,
  reminderWeekdays,
} from '@/features/habits/domain/schedule';

// 2026-10-05 is a Monday.
const TODAY: DateKey = '2026-10-05';
const day = (offset: number): DateKey => addDaysToKey(TODAY, offset);

const done = (offset: number, count = 1): HabitLog => ({
  date: day(offset),
  count,
  status: 'done',
});
const skipped = (offset: number): HabitLog => ({ date: day(offset), count: 1, status: 'skipped' });

interface Setup {
  period?: HabitPeriod;
  goalCount?: number;
  weekdays?: number;
  startOffset?: number;
  logs?: HabitLog[];
  pauses?: HabitPause[];
  today?: DateKey;
}

function evaluate({
  period = 'daily',
  goalCount = 1,
  weekdays = ALL_WEEKDAYS,
  startOffset = -60,
  logs = [],
  pauses = [],
  today = TODAY,
}: Setup) {
  return createEvaluator(
    { period, goalCount, weekdays, startDate: day(startOffset) },
    { logs, pauses },
    today,
  );
}

describe('daily habits', () => {
  it('counts consecutive completed days up to today', () => {
    const e = evaluate({ logs: [done(-2), done(-1), done(0)] });
    assert.deepEqual(e.streaks(), { current: 3, best: 3 });
    assert.equal(e.current().state, 'satisfied');
  });

  it("does not break the streak just because today isn't done yet", () => {
    const e = evaluate({ logs: [done(-3), done(-2), done(-1)] });
    assert.deepEqual(e.streaks(), { current: 3, best: 3 });
    assert.equal(e.current().state, 'pending');
  });

  it('resets on a missed day but remembers the best run', () => {
    const e = evaluate({ logs: [done(-6), done(-5), done(-4), done(-2), done(-1), done(0)] });
    assert.deepEqual(e.streaks(), { current: 3, best: 3 });
    const broken = evaluate({ logs: [done(-6), done(-5), done(-4), done(-3), done(-1), done(0)] });
    assert.deepEqual(broken.streaks(), { current: 2, best: 4 });
  });

  it('breaks the current streak once a full day is missed', () => {
    const e = evaluate({ logs: [done(-5), done(-4), done(-3), done(-2)] });
    assert.deepEqual(e.streaks(), { current: 0, best: 4 });
  });

  it('requires the full daily goal, not just any completion', () => {
    const e = evaluate({ goalCount: 3, logs: [done(-2, 3), done(-1, 2), done(0, 3)] });
    assert.deepEqual(e.streaks(), { current: 1, best: 1 });
    assert.equal(e.progressOf(day(-1)).state, 'missed');
    assert.equal(e.progressOf(day(-1)).done, 2);
  });

  it('treats a skipped day as excused: neither extending nor breaking', () => {
    const e = evaluate({ logs: [done(-3), done(-2), skipped(-1), done(0)] });
    assert.deepEqual(e.streaks(), { current: 3, best: 3 });
    assert.equal(e.progressOf(day(-1)).state, 'excused');
  });

  it('shows a skipped day today as excused, not pending', () => {
    const e = evaluate({ logs: [done(-2), done(-1), skipped(0)] });
    assert.equal(e.current().state, 'excused');
    assert.equal(e.dayLog(TODAY).skipped, true);
    assert.deepEqual(e.streaks(), { current: 2, best: 2 });
  });

  it('lets a real completion override an earlier skip on the same period', () => {
    const e = evaluate({ logs: [done(-1), done(0)] });
    assert.equal(e.current().state, 'satisfied');
  });

  it('excuses paused days, including an open-ended pause', () => {
    const closed = evaluate({
      logs: [done(-6), done(-5), done(0)],
      pauses: [{ id: 'p', start: day(-4), end: day(0) }],
    });
    assert.deepEqual(closed.streaks(), { current: 3, best: 3 });
    assert.equal(closed.progressOf(day(-4)).state, 'excused');
    assert.equal(closed.progressOf(day(0)).state, 'satisfied');

    const open = evaluate({
      logs: [done(-6), done(-5)],
      pauses: [{ id: 'p', start: day(-4), end: null }],
    });
    assert.deepEqual(open.streaks(), { current: 2, best: 2 });
    assert.equal(open.current().state, 'excused');
  });

  it('ignores anything before the start date and in the future', () => {
    const e = evaluate({ startOffset: -2, logs: [done(-2), done(-1)] });
    assert.deepEqual(e.streaks(), { current: 2, best: 2 });
    const future = evaluate({ startOffset: 3, logs: [] });
    assert.deepEqual(future.streaks(), { current: 0, best: 0 });
  });
});

describe('backfilled history', () => {
  it('extends the effective start date back to the earliest logged day', () => {
    const e = evaluate({ startOffset: 0, logs: [done(-3), done(-2), done(-1), done(0)] });
    assert.deepEqual(e.streaks(), { current: 4, best: 4 });
    assert.equal(e.heatmap(day(-3), day(-3))[0]?.status, 'done');
    assert.equal(e.heatmap(day(-4), day(-4))[0]?.status, 'blank');
  });
});

describe('custom weekdays (Mon, Wed, Fri)', () => {
  const mwf = weekdayBit(1) | weekdayBit(3) | weekdayBit(5);

  it('ignores unscheduled days and counts only scheduled ones', () => {
    // Today is Monday. Previous scheduled days: Fri (-3), Wed (-5), Mon (-7).
    const e = evaluate({ weekdays: mwf, logs: [done(-7), done(-5), done(-3), done(0)] });
    assert.deepEqual(e.streaks(), { current: 4, best: 4 });
    assert.equal(e.progressOf(day(-1)).state, 'off'); // Sunday
    assert.equal(e.progressOf(day(-2)).state, 'off'); // Saturday
  });

  it('breaks on a missed scheduled day', () => {
    const e = evaluate({ weekdays: mwf, logs: [done(-7), done(-3), done(0)] });
    assert.deepEqual(e.streaks(), { current: 2, best: 2 });
  });

  it('knows which days are scheduled', () => {
    assert.equal(isScheduledOn({ period: 'daily', weekdays: mwf }, '2026-10-05'), true);
    assert.equal(isScheduledOn({ period: 'daily', weekdays: mwf }, '2026-10-06'), false);
    assert.equal(isScheduledOn({ period: 'weekly', weekdays: mwf }, '2026-10-06'), true);
  });
});

describe('weekly goals', () => {
  it('sums completions across the week and counts satisfied weeks', () => {
    // Weeks (Mon-Sun): this week starts today. Last week -7..-1, the week before -14..-8.
    const e = evaluate({
      period: 'weekly',
      goalCount: 3,
      logs: [done(-13), done(-12), done(-10), done(-6), done(-4), done(-2), done(0)],
    });
    assert.deepEqual(e.streaks(), { current: 2, best: 2 });
    assert.equal(e.current().done, 1);
    assert.equal(e.current().state, 'pending');
  });

  it('breaks when a past week falls short', () => {
    const e = evaluate({
      period: 'weekly',
      goalCount: 3,
      logs: [done(-13), done(-12), done(-10), done(-6), done(-4)],
    });
    assert.deepEqual(e.streaks(), { current: 0, best: 1 });
  });

  it('does not penalise the partial first week after the habit starts', () => {
    const e = evaluate({
      period: 'weekly',
      goalCount: 3,
      startOffset: -10,
      logs: [done(-6), done(-5), done(-4)],
    });
    assert.equal(e.progressOf(unitKeyOf(day(-10), 'weekly')).state, 'excused');
    assert.deepEqual(e.streaks(), { current: 1, best: 1 });
  });

  it('excuses a week with a skipped day when the goal is not reached', () => {
    const e = evaluate({
      period: 'weekly',
      goalCount: 3,
      logs: [done(-13), done(-12), done(-10), done(-6), skipped(-5)],
    });
    assert.deepEqual(e.streaks(), { current: 1, best: 1 });
    assert.equal(e.progressOf(unitKeyOf(day(-6), 'weekly')).state, 'excused');
  });
});

describe('monthly goals', () => {
  it('counts months across a year boundary', () => {
    const e = evaluate({
      period: 'monthly',
      goalCount: 2,
      today: '2026-01-15',
      startOffset: -400,
      logs: [
        { date: '2025-11-03', count: 1, status: 'done' },
        { date: '2025-11-20', count: 1, status: 'done' },
        { date: '2025-12-01', count: 2, status: 'done' },
        { date: '2026-01-02', count: 1, status: 'done' },
      ],
    });
    assert.deepEqual(e.streaks(), { current: 2, best: 2 });
    assert.equal(e.current().state, 'pending');
  });
});

describe('periods', () => {
  it('computes unit keys, ranges and neighbours', () => {
    assert.equal(unitKeyOf('2026-10-08', 'weekly'), '2026-10-05');
    assert.equal(unitKeyOf('2026-10-11', 'weekly'), '2026-10-05');
    assert.equal(unitKeyOf('2026-10-12', 'weekly'), '2026-10-12');
    assert.equal(unitKeyOf('2026-10-31', 'monthly'), '2026-10');
    assert.deepEqual(unitRange('2026-02', 'monthly'), { start: '2026-02-01', end: '2026-02-28' });
    assert.deepEqual(unitRange('2028-02', 'monthly'), { start: '2028-02-01', end: '2028-02-29' });
    assert.equal(nextUnit('2026-12', 'monthly'), '2027-01');
    assert.equal(previousUnit('2026-01', 'monthly'), '2025-12');
    assert.equal(nextUnit('2026-10-05', 'weekly'), '2026-10-12');
    assert.equal(nextUnit('2026-02-28', 'daily'), '2026-03-01');
  });

  it('steps across daylight-saving changes without skipping or repeating days', () => {
    let unit: string = '2026-03-05';
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      assert.ok(!seen.has(unit), `repeated ${unit}`);
      seen.add(unit);
      unit = nextUnit(unit, 'daily');
    }
    assert.equal(unit, '2026-05-04');
  });
});

describe('heatmap', () => {
  it('classifies each day', () => {
    const e = evaluate({
      goalCount: 2,
      weekdays: weekdayBit(1) | weekdayBit(2) | weekdayBit(3) | weekdayBit(4) | weekdayBit(5),
      startOffset: -7,
      logs: [done(-6, 2), done(-5, 1), skipped(-4)],
      pauses: [{ id: 'p', start: day(-3), end: day(-2) }],
    });
    const days = e.heatmap(day(-8), day(1));
    const by = (offset: number) => days.find((d) => d.date === day(offset));

    assert.equal(by(-8)?.status, 'blank'); // before start
    assert.deepEqual([by(-6)?.status, by(-6)?.level], ['done', 4]);
    assert.deepEqual([by(-5)?.status, by(-5)?.level], ['partial', 2]);
    assert.equal(by(-4)?.status, 'skipped');
    assert.equal(by(-3)?.status, 'paused');
    assert.equal(by(-2)?.status, 'off'); // Saturday is not scheduled
    assert.equal(by(-1)?.status, 'off'); // Sunday
    assert.equal(by(0)?.status, 'none'); // today, scheduled, nothing logged yet
    assert.equal(by(1)?.status, 'blank'); // future
  });

  it('shows bonus completions on unscheduled days', () => {
    const e = evaluate({ weekdays: weekdayBit(1), logs: [done(-1)] });
    assert.equal(e.heatmap(day(-1), day(-1))[0]?.status, 'done');
  });
});

describe('stats', () => {
  it('summarises completions, rate, recent periods and weekday spread', () => {
    const e = evaluate({
      startOffset: -9,
      logs: [
        done(-9, 1),
        done(-8, 1),
        done(-6, 1),
        done(-5, 1),
        done(-4, 1),
        done(-1, 1),
        done(0, 1),
      ],
    });
    const stats = e.stats();
    assert.equal(stats.totalCompletions, 7);
    assert.equal(stats.activeDays, 7);
    assert.equal(stats.currentStreak, 2);
    assert.equal(stats.bestStreak, 3);
    assert.equal(stats.recent.length, 7);
    assert.equal(stats.recent.at(-1)?.unit, TODAY);
    // 10 closed-or-satisfied days from -9..0: 7 satisfied, 3 missed.
    assert.equal(stats.successRate, 7 / 10);
    // Offsets -9..0 from a Monday: Sat, Sun, Tue, Wed, Thu, Sun, Mon.
    assert.deepEqual(stats.weekdayCounts, [2, 1, 1, 1, 1, 0, 1]);
  });

  it('has no success rate before any period has closed', () => {
    const e = evaluate({ startOffset: 0, logs: [] });
    assert.equal(e.stats().successRate, null);
  });

  it('limits recent periods by habit type and age', () => {
    assert.equal(evaluate({ period: 'weekly', startOffset: -200 }).stats().recent.length, 8);
    assert.equal(evaluate({ period: 'monthly', startOffset: -400 }).stats().recent.length, 6);
    assert.equal(evaluate({ startOffset: -2 }).stats().recent.length, 3);
  });
});

describe('summaries and schedules', () => {
  it('summarises a habit for lists', () => {
    const habit = {
      id: 'h',
      name: 'Read',
      notes: '',
      icon: 'book',
      color: '#fff',
      period: 'daily' as const,
      goalCount: 2,
      weekdays: ALL_WEEKDAYS,
      reminderTime: null,
      category: null,
      startDate: day(-30),
      archivedAt: null,
      createdAt: 0,
      paused: false,
    };
    const summary = summarize(habit, { logs: [done(-1, 2), done(0, 1)], pauses: [] }, TODAY);
    assert.equal(summary.streak, 1);
    assert.equal(summary.todayCount, 1);
    assert.equal(summary.current.state, 'pending');
    assert.equal(summary.scheduledToday, true);
  });

  it('maps frequency presets both ways', () => {
    assert.equal(presetOf({ period: 'daily', weekdays: ALL_WEEKDAYS }), 'daily');
    assert.equal(presetOf({ period: 'daily', weekdays: 0b0000110 }), 'custom');
    assert.equal(presetOf({ period: 'weekly', weekdays: ALL_WEEKDAYS }), 'weekly');
    assert.deepEqual(frequencyForPreset('monthly', { period: 'daily', weekdays: ALL_WEEKDAYS }), {
      period: 'monthly',
      weekdays: ALL_WEEKDAYS,
    });
    const custom = frequencyForPreset('custom', { period: 'daily', weekdays: ALL_WEEKDAYS });
    assert.equal(custom.period, 'daily');
    assert.notEqual(custom.weekdays, ALL_WEEKDAYS);
    assert.deepEqual(frequencyForPreset('custom', { period: 'daily', weekdays: 0b0000110 }), {
      period: 'daily',
      weekdays: 0b0000110,
    });
  });

  it('reminds on scheduled weekdays only for daily habits', () => {
    assert.deepEqual(reminderWeekdays({ period: 'daily', weekdays: 0b0101010 }), [1, 3, 5]);
    assert.deepEqual(
      reminderWeekdays({ period: 'weekly', weekdays: ALL_WEEKDAYS }),
      [0, 1, 2, 3, 4, 5, 6],
    );
  });
});
