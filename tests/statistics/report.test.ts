import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { productivityScore } from '@/features/statistics/domain/report';

import { at, createStats, type StatsFixture } from './setup';

// Thursday 15 October 2026, 18:00.
const TODAY = '2026-10-15';
let s: StatsFixture;
beforeEach(() => {
  s = createStats(at(2026, 10, 15, 18));
});

const week = () => s.stats.report('week', TODAY);

describe('tasks', () => {
  it('counts completions, creations and the completion rate of tasks that came due', async () => {
    s.addTask('done on time', {
      createdAt: at(2026, 10, 12),
      dueAt: at(2026, 10, 14),
      completedAt: at(2026, 10, 13),
    });
    s.addTask('done late', {
      createdAt: at(2026, 10, 12),
      dueAt: at(2026, 10, 13),
      completedAt: at(2026, 10, 15, 9),
    });
    s.addTask('overdue', { createdAt: at(2026, 10, 13), dueAt: at(2026, 10, 14) });
    s.addTask('still ahead', { createdAt: at(2026, 10, 13), dueAt: at(2026, 10, 17) });
    s.addTask('no date', { createdAt: at(2026, 10, 14), completedAt: at(2026, 10, 16) });
    s.addTask('thrown away', {
      createdAt: at(2026, 10, 14),
      completedAt: at(2026, 10, 14),
      deleted: true,
    });
    s.addTask('last week', {
      createdAt: at(2026, 10, 5),
      completedAt: at(2026, 10, 6),
      dueAt: at(2026, 10, 6),
    });

    const { current, previous } = await week();
    assert.equal(current.tasks.completed, 3);
    assert.equal(current.tasks.created, 5);
    assert.deepEqual(
      [current.tasks.due, current.tasks.dueCompleted, current.tasks.overdue],
      [4, 2, 1],
    );
    assert.equal(current.tasks.rate, 2 / 3);
    assert.equal(current.scores.tasks, 67);
    assert.equal(previous.tasks.completed, 1);
    assert.equal(previous.tasks.rate, 1);
  });

  it('counts a completion even when the task was archived afterwards', async () => {
    s.addTask('archived', {
      createdAt: at(2026, 10, 12),
      completedAt: at(2026, 10, 13),
      archived: true,
    });
    s.addTask('kept', { createdAt: at(2026, 10, 12), completedAt: at(2026, 10, 13) });
    assert.equal((await week()).current.tasks.completed, 2);
  });

  it('has no rate when nothing was due', async () => {
    const { current } = await week();
    assert.equal(current.tasks.rate, null);
    assert.equal(current.scores.tasks, null);
  });
});

describe('habits', () => {
  const logs = (...days: number[]) =>
    days.map((day) => ({ date: `2026-10-${String(day).padStart(2, '0')}` }));

  it('measures how many finished days met the goal and ignores days still to come', async () => {
    s.addHabit('Read', '2026-10-01', logs(12, 14));
    const { current } = await week();
    // Mon 12 met, Tue 13 missed, Wed 14 met; today is open and not counted as missed.
    assert.deepEqual([current.habits.met, current.habits.missed], [2, 1]);
    assert.equal(current.habits.consistency, 2 / 3);
    assert.equal(current.habits.completions, 2);
    assert.equal(current.scores.habits, 67);
  });

  it('does not penalise skipped days or days before the habit started', async () => {
    s.addHabit('Stretch', '2026-10-13', [{ date: '2026-10-14', status: 'skipped' }, ...logs(13)]);
    const { current } = await week();
    assert.deepEqual([current.habits.met, current.habits.missed], [1, 0]);
    assert.equal(current.habits.consistency, 1);
  });

  it('shows progress so far while the only day is still open', async () => {
    s.addHabit('Water', '2026-10-01', logs(15));
    const day = await s.stats.report('day', TODAY);
    assert.equal(day.current.habits.consistency, 1);
    assert.equal(day.current.habits.completions, 1);
    s.addHabit('Walk', '2026-10-01');
    assert.equal((await s.stats.report('day', TODAY)).current.habits.consistency, 0.5);
  });

  it('has nothing to judge in a period that has not started', async () => {
    s.addHabit('Read', '2026-10-01', logs(12));
    const next = await s.stats.report('week', '2026-10-22');
    assert.equal(next.current.habits.consistency, null);
  });

  it('counts check-ins per day in the chart', async () => {
    s.addHabit('Read', '2026-10-01', [{ date: '2026-10-12', count: 3 }, ...logs(14)]);
    const { series } = await week();
    assert.deepEqual(
      series.habits?.map((point) => point.value),
      [3, 0, 1, 0, 0, 0, 0],
    );
  });
});

describe('focus', () => {
  it('adds up focus time and weights the score by session length', async () => {
    await s.addFocus(at(2026, 10, 14, 9), 60, { deepFocus: 100 });
    await s.addFocus(at(2026, 10, 15, 9), 20, { deepFocus: 40, outcome: 'stopped' });
    await s.addFocus(at(2026, 10, 7, 9), 30, { deepFocus: 70 });
    const { current, previous, series } = await week();
    assert.deepEqual(
      [current.focus.seconds, current.focus.sessions, current.focus.completedSessions],
      [4800, 2, 1],
    );
    assert.equal(current.focus.deepFocus, 85);
    assert.equal(current.scores.focus, 85);
    assert.equal(previous.focus.deepFocus, 70);
    assert.deepEqual(
      series.focus?.map((point) => point.value),
      [0, 0, 60, 20, 0, 0, 0],
    );
  });

  it('breaks a day down by hour', async () => {
    await s.addFocus(at(2026, 10, 15, 9, 10), 25);
    await s.addFocus(at(2026, 10, 15, 14), 50);
    const day = await s.stats.report('day', TODAY);
    const hours = day.series.focus?.map((point) => point.value) ?? [];
    assert.equal(hours.length, 24);
    assert.deepEqual([hours[9], hours[14], hours.reduce((a, b) => a + b, 0)], [25, 50, 75]);
    assert.equal(day.series.habits, undefined);
  });
});

describe('calendar', () => {
  it('counts events, scheduled hours, days with events and the busiest weekday', async () => {
    s.addEvent('Standup', at(2026, 10, 12, 9), at(2026, 10, 12, 10));
    s.addEvent('Workshop', at(2026, 10, 14, 13), at(2026, 10, 14, 16));
    s.addEvent('Review', at(2026, 10, 14, 17), at(2026, 10, 14, 17, 30));
    s.addEvent('Holiday', at(2026, 10, 16, 0), at(2026, 10, 17, 0), { allDay: true });
    s.addEvent('Next week', at(2026, 10, 20, 9), at(2026, 10, 20, 10));
    const { current } = await week();
    assert.equal(current.calendar.events, 4);
    assert.equal(current.calendar.hours, 4.5);
    assert.equal(current.calendar.daysWithEvents, 3);
    assert.equal(current.calendar.busiestWeekday, 3);
    // Three of the four days so far (Mon to Thu) had something; the all-day one is still ahead.
    assert.equal(current.calendar.usage, 3 / 4);
  });

  it('expands repeating events inside the period and in the chart', async () => {
    s.addEvent('Daily sync', at(2026, 9, 1, 9), at(2026, 9, 1, 9, 15), { repeatUnit: 'day' });
    const { current, series } = await week();
    assert.equal(current.calendar.events, 7);
    assert.deepEqual(
      series.events?.map((point) => point.value),
      [1, 1, 1, 1, 1, 1, 1],
    );
    const month = await s.stats.report('month', TODAY);
    assert.equal(month.current.calendar.events, 31);
  });
});

describe('finance', () => {
  it('summarises income, spending, net and savings rate against the previous period', async () => {
    const food = s.addCategory('Food');
    const fun = s.addCategory('Fun');
    s.addTransaction('income', 200_000, at(2026, 10, 12));
    s.addTransaction('expense', 30_000, at(2026, 10, 13), food);
    s.addTransaction('expense', 10_000, at(2026, 10, 14), food);
    s.addTransaction('expense', 10_000, at(2026, 10, 16), fun);
    s.addTransaction('expense', 5_000, at(2026, 10, 7), fun);
    const report = await week();
    assert.equal(report.currency, 'USD');
    assert.deepEqual(
      [
        report.finance.incomeMinor,
        report.finance.expenseMinor,
        report.finance.netMinor,
        report.finance.savingsRate,
      ],
      [200_000, 50_000, 150_000, 0.75],
    );
    assert.deepEqual(
      report.finance.topCategories.map((slice) => [
        slice.name,
        slice.totalMinor,
        Math.round(slice.share * 100),
      ]),
      [
        ['Food', 40_000, 80],
        ['Fun', 10_000, 20],
      ],
    );
    assert.equal(report.previousFinance.expenseMinor, 5_000);
    assert.equal(report.previousFinance.savingsRate, null);
    assert.deepEqual(
      report.spending.map((point) => point.value),
      [0, 30_000, 10_000, 0, 10_000, 0, 0],
    );
  });

  it('uses the chosen currency', async () => {
    s.storage.setString('finance.currency', 'EUR');
    assert.equal((await week()).currency, 'EUR');
  });
});

describe('notes', () => {
  it('counts notes written and edited, leaving out the trash', async () => {
    s.addNote('new', at(2026, 10, 13));
    s.addNote('edited', at(2026, 10, 1), at(2026, 10, 14));
    s.addNote('trashed', at(2026, 10, 13), at(2026, 10, 13), { deleted: true });
    s.addNote('old', at(2026, 9, 1));
    const report = await week();
    assert.deepEqual([report.current.notes.created, report.current.notes.updated], [1, 1]);
    assert.equal(report.totals.activeNotes, 3);
    assert.deepEqual(
      report.series.notes?.map((point) => point.value),
      [0, 1, 0, 0, 0, 0, 0],
    );
  });
});

describe('productivity score', () => {
  it('blends the scores that exist, tasks and habits a little above focus', () => {
    assert.equal(productivityScore({ tasks: 100, habits: 100, focus: 100 }), 100);
    assert.equal(productivityScore({ tasks: 80, habits: 60, focus: 40 }), 61);
    assert.equal(productivityScore({ tasks: 80, habits: null, focus: null }), 80);
    assert.equal(productivityScore({ tasks: null, habits: 50, focus: 100 }), 73);
    assert.equal(productivityScore({ tasks: null, habits: null, focus: null }), null);
  });

  it('is empty for an empty app and appears as data arrives', async () => {
    assert.equal((await week()).current.scores.productivity, null);
    await s.addFocus(at(2026, 10, 14, 9), 25, { deepFocus: 90 });
    assert.equal((await week()).current.scores.productivity, 90);
  });
});

describe('periods', () => {
  it('reports the month and the year, with the previous one for comparison', async () => {
    s.addTask('a', { createdAt: at(2026, 3, 3), completedAt: at(2026, 3, 4) });
    s.addTask('b', { createdAt: at(2026, 10, 3), completedAt: at(2026, 10, 4) });
    s.addTask('c', { createdAt: at(2025, 10, 3), completedAt: at(2025, 10, 4) });
    const year = await s.stats.report('year', TODAY);
    assert.equal(year.current.tasks.completed, 2);
    assert.equal(year.previous.tasks.completed, 1);
    assert.deepEqual(
      year.series.tasks?.map((point) => point.value),
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    );
    const month = await s.stats.report('month', '2026-10-31');
    assert.equal(month.current.tasks.completed, 1);
    assert.equal(month.series.tasks?.length, 31);
  });

  it('can look at the past', async () => {
    s.addTask('then', { createdAt: at(2026, 9, 3), completedAt: at(2026, 9, 4) });
    const lastMonth = await s.stats.report('month', '2026-09-10');
    assert.equal(lastMonth.current.tasks.completed, 1);
    assert.equal(lastMonth.range.to, '2026-09-30');
  });
});
