import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { addDaysToKey, createCategoryUseCases, toDateKey, weekdayBit } from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { SqliteHabitRepository } from '@/features/habits/data/sqlite-habit-repository';
import {
  DEFAULT_HABIT_FILTER,
  DEFAULT_HABIT_SORT,
  todayOverview,
  type HabitFilter,
  type HabitScope,
  type HabitSort,
} from '@/features/habits/domain/filters';
import type {
  HabitReminder,
  HabitReminderScheduler,
  HabitScheduleOutcome,
} from '@/features/habits/domain/ports';
import { createHabitUseCases } from '@/features/habits/domain/usecases';
import { emptyHabitDraft, type HabitDraft } from '@/features/habits/domain/validation';

import { createTestDatabase } from '../tasks/test-database';

class FakeScheduler implements HabitReminderScheduler {
  active = new Map<string, HabitReminder>();
  cancelled: string[] = [];
  blocked = false;
  private counter = 0;

  async schedule(reminder: HabitReminder): Promise<HabitScheduleOutcome> {
    if (this.blocked) {
      return { status: 'blocked' };
    }
    const ids = (reminder.weekdays.length === 7 ? [null] : reminder.weekdays).map(() => {
      this.counter += 1;
      const id = `n${this.counter}`;
      this.active.set(id, reminder);
      return id;
    });
    return { status: 'scheduled', notificationIds: ids };
  }

  async cancel(ids: readonly string[]) {
    ids.forEach((id) => {
      this.cancelled.push(id);
      this.active.delete(id);
    });
  }
}

let now = new Date(2026, 9, 5, 12).getTime(); // Monday
const todayKey = () => toDateKey(now);
const day = (offset: number) => addDaysToKey(todayKey(), offset);

let habits: ReturnType<typeof createHabitUseCases>;
let scheduler: FakeScheduler;
let db: ReturnType<typeof createTestDatabase>;

beforeEach(() => {
  now = new Date(2026, 9, 5, 12).getTime();
  db = createTestDatabase();
  scheduler = new FakeScheduler();
  const clock = { now: () => now };
  habits = createHabitUseCases({
    habits: new SqliteHabitRepository(db),
    categories: new SqliteCategoryRepository(db, 'habit', clock.now),
    reminders: scheduler,
    clock,
  });
});

const draft = (overrides: Partial<HabitDraft> = {}): HabitDraft => ({
  ...emptyHabitDraft('self-improvement', '#7B2FF7'),
  name: 'Read',
  ...overrides,
});

async function create(overrides: Partial<HabitDraft> = {}) {
  const result = await habits.save(draft(overrides), null);
  assert.ok(result.ok, 'expected save to succeed');
  return result.id;
}

const list = (
  scope: HabitScope = 'active',
  filter: Partial<HabitFilter> = {},
  sort: HabitSort = DEFAULT_HABIT_SORT,
) => habits.list(scope, { ...DEFAULT_HABIT_FILTER, ...filter }, sort);
const names = async (...args: Parameters<typeof list>) =>
  (await list(...args)).map((s) => s.habit.name);

describe('create and edit', () => {
  it('persists every field', async () => {
    const category = await habits.categories.save({ id: null, name: 'Health', color: '#0891B2' });
    assert.ok(category.ok);
    const id = await create({
      name: '  Drink water  ',
      notes: ' 2 litres ',
      icon: 'local-drink',
      color: '#2563EB',
      categoryId: category.id,
      period: 'daily',
      goalCount: 8,
      weekdays: weekdayBit(1) | weekdayBit(3),
      reminderTime: '08:30',
    });

    const detail = await habits.detail(id);
    assert.ok(detail);
    assert.deepEqual(
      { ...detail.entry.habit, createdAt: 0 },
      {
        id,
        name: 'Drink water',
        notes: '2 litres',
        icon: 'local-drink',
        color: '#2563EB',
        period: 'daily',
        goalCount: 8,
        weekdays: weekdayBit(1) | weekdayBit(3),
        reminderTime: '08:30',
        category: { id: category.id, name: 'Health', color: '#0891B2' },
        startDate: todayKey(),
        archivedAt: null,
        createdAt: 0,
        paused: false,
      },
    );
  });

  it('ignores the weekday mask for weekly and monthly habits', async () => {
    const id = await create({ period: 'weekly', weekdays: weekdayBit(2), goalCount: 3 });
    assert.equal((await habits.detail(id))?.entry.habit.weekdays, 127);
  });

  it('rejects invalid drafts without writing anything', async () => {
    const results = await Promise.all([
      habits.save(draft({ name: ' ' }), null),
      habits.save(draft({ goalCount: 0 }), null),
      habits.save(draft({ goalCount: 100 }), null),
      habits.save(draft({ period: 'daily', weekdays: 0 }), null),
      habits.save(draft({ reminderTime: '25:00' }), null),
    ]);
    assert.ok(results.every((r) => !r.ok));
    assert.equal((await list()).length, 0);
  });

  it('edits in place, keeping history, start date and creation time', async () => {
    const id = await create();
    await habits.setCount(id, todayKey(), 1);
    const before = await habits.detail(id);
    now += 86_400_000;
    await habits.save(draft({ name: 'Read more', goalCount: 2, color: '#16A34A' }), id);

    const after = await habits.detail(id);
    assert.equal(after?.entry.habit.name, 'Read more');
    assert.equal(after?.entry.habit.goalCount, 2);
    assert.equal(after?.entry.habit.startDate, before?.entry.habit.startDate);
    assert.equal(after?.entry.habit.createdAt, before?.entry.habit.createdAt);
    assert.equal(after?.entry.logs.length, 1);
  });

  it('fails clearly when editing a habit that no longer exists', async () => {
    await assert.rejects(() => habits.save(draft(), 'missing'), /no longer exists/);
  });
});

describe('logging progress', () => {
  it('adjusts counts up and down, clamped at zero', async () => {
    const id = await create({ goalCount: 3 });
    assert.equal(await habits.adjust(id, todayKey(), 1), 1);
    assert.equal(await habits.adjust(id, todayKey(), 1), 2);
    assert.equal(await habits.adjust(id, todayKey(), -5), 0);
    assert.equal((await habits.detail(id))?.entry.logs.length, 0);
  });

  it('sets an exact count and clears the day at zero', async () => {
    const id = await create({ goalCount: 3 });
    await habits.setCount(id, todayKey(), 3);
    assert.equal((await habits.detail(id))?.summary.current.state, 'satisfied');
    await habits.setCount(id, todayKey(), 0);
    assert.equal((await habits.detail(id))?.summary.todayCount, 0);
  });

  it('skipping excuses the day, and logging progress replaces the skip', async () => {
    const id = await create();
    await habits.skip(id, todayKey(), true);
    let detail = await habits.detail(id);
    assert.equal(detail?.summary.skippedToday, true);
    assert.equal(detail?.summary.current.state, 'excused');

    await habits.setCount(id, todayKey(), 1);
    detail = await habits.detail(id);
    assert.equal(detail?.summary.skippedToday, false);
    assert.equal(detail?.summary.current.state, 'satisfied');

    await habits.skip(id, day(-1), true);
    await habits.skip(id, day(-1), false);
    assert.equal(
      (await habits.detail(id))?.entry.logs.some((l) => l.date === day(-1)),
      false,
    );
  });

  it('computes streaks from stored history', async () => {
    const id = await create();
    for (const offset of [-3, -2, -1, 0]) {
      await habits.setCount(id, day(offset), 1);
    }
    const detail = await habits.detail(id);
    assert.equal(detail?.summary.streak, 4);
    assert.equal(detail?.stats.currentStreak, 4);
    assert.equal(detail?.stats.totalCompletions, 4);
  });
});

describe('pause and resume', () => {
  it('marks the habit paused and records the paused range once resumed', async () => {
    const id = await create();
    await habits.setCount(id, day(-3), 1);
    const pausedOn = todayKey();
    await habits.pause(id);
    assert.equal((await habits.detail(id))?.entry.habit.paused, true);

    now += 3 * 86_400_000;
    await habits.resume(id);
    const detail = await habits.detail(id);
    assert.equal(detail?.entry.habit.paused, false);
    assert.deepEqual(
      detail?.entry.pauses.map((p) => [p.start, p.end]),
      [[pausedOn, todayKey()]],
    );
  });

  it('removes a pause that is resumed the same day', async () => {
    const id = await create();
    await habits.pause(id);
    await habits.resume(id);
    assert.equal((await habits.detail(id))?.entry.pauses.length, 0);
  });

  it('keeps a streak alive across a pause', async () => {
    const id = await create();
    await habits.setCount(id, day(-5), 1);
    await habits.setCount(id, day(-4), 1);
    now -= 3 * 86_400_000;
    await habits.pause(id);
    now += 3 * 86_400_000;
    await habits.resume(id);
    await habits.setCount(id, todayKey(), 1);
    assert.equal((await habits.detail(id))?.summary.streak, 3);
  });

  it('ignores a second pause while one is open', async () => {
    const id = await create();
    await habits.pause(id);
    await habits.pause(id);
    now += 86_400_000;
    await habits.resume(id);
    assert.equal((await habits.detail(id))?.entry.pauses.length, 1);
  });
});

describe('archive, restore and delete', () => {
  it('moves habits between scopes', async () => {
    const id = await create({ name: 'Old' });
    await create({ name: 'Keep' });
    await habits.archive(id);
    assert.deepEqual(await names('active'), ['Keep']);
    assert.deepEqual(await names('archived'), ['Old']);
    await habits.restore(id);
    assert.deepEqual(await names('active'), ['Old', 'Keep']);
  });

  it('deletes a habit with its history', async () => {
    const id = await create();
    await habits.setCount(id, todayKey(), 1);
    await habits.pause(id);
    await habits.remove(id);
    assert.equal(await habits.detail(id), null);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM habit_logs')?.n, 0);
    assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM habit_pauses')?.n, 0);
  });

  it('detaches a deleted category from its habits', async () => {
    const category = await habits.categories.save({ id: null, name: 'Temp', color: '#000' });
    assert.ok(category.ok);
    const id = await create({ categoryId: category.id });
    await habits.categories.delete(category.id);
    assert.equal((await habits.detail(id))?.entry.habit.category, null);
  });
});

describe('reminders', () => {
  it('schedules one repeating reminder for an every-day habit', async () => {
    const id = await create({ name: 'Meditate', reminderTime: '07:15' });
    assert.equal(scheduler.active.size, 1);
    const [reminder] = [...scheduler.active.values()];
    assert.deepEqual(
      [reminder?.habitId, reminder?.title, reminder?.hour, reminder?.minute],
      [id, 'Meditate', 7, 15],
    );
    assert.equal((await habits.detail(id))?.entry.notificationIds.length, 1);
  });

  it('schedules one reminder per chosen weekday for custom habits', async () => {
    await create({
      weekdays: weekdayBit(1) | weekdayBit(3) | weekdayBit(5),
      reminderTime: '18:00',
    });
    assert.equal(scheduler.active.size, 3);
    assert.deepEqual([...scheduler.active.values()][0]?.weekdays, [1, 3, 5]);
  });

  it('reminds every day for weekly and monthly habits', async () => {
    await create({ period: 'weekly', goalCount: 3, reminderTime: '09:00' });
    assert.equal(scheduler.active.size, 1);
    assert.equal([...scheduler.active.values()][0]?.weekdays.length, 7);
  });

  it('reschedules on edit without leaking old notifications', async () => {
    const id = await create({ reminderTime: '07:00' });
    await habits.save(draft({ reminderTime: '21:30' }), id);
    assert.equal(scheduler.active.size, 1);
    assert.equal([...scheduler.active.values()][0]?.hour, 21);
    await habits.save(draft({ reminderTime: null }), id);
    assert.equal(scheduler.active.size, 0);
  });

  it('stops while paused or archived and resumes afterwards', async () => {
    const id = await create({ reminderTime: '07:00' });
    await habits.pause(id);
    assert.equal(scheduler.active.size, 0);
    now += 86_400_000;
    await habits.resume(id);
    assert.equal(scheduler.active.size, 1);
    await habits.archive(id);
    assert.equal(scheduler.active.size, 0);
    await habits.restore(id);
    assert.equal(scheduler.active.size, 1);
  });

  it('cancels reminders when the habit is deleted', async () => {
    const id = await create({ reminderTime: '07:00' });
    await habits.remove(id);
    assert.equal(scheduler.active.size, 0);
  });

  it('saves the habit but reports blocked notifications', async () => {
    scheduler.blocked = true;
    const result = await habits.save(draft({ reminderTime: '07:00' }), null);
    assert.ok(result.ok && result.reminder === 'blocked');
    assert.equal((await list()).length, 1);
    assert.equal(scheduler.active.size, 0);
  });
});

describe('search, filter and sort', () => {
  beforeEach(async () => {
    const work = await habits.categories.save({ id: null, name: 'Work', color: '#000' });
    assert.ok(work.ok);
    const readId = await create({ name: 'Read', notes: 'Fiction before bed', categoryId: work.id });
    const runId = await create({ name: 'Éveil matinal', period: 'weekly', goalCount: 3 });
    const gymId = await create({ name: 'Gym', goalCount: 2 });
    now += 1000;
    const pausedId = await create({ name: 'Paused one', period: 'monthly', goalCount: 4 });

    await habits.setCount(readId, todayKey(), 1); // satisfied
    await habits.setCount(gymId, todayKey(), 1); // 1 of 2
    await habits.setCount(runId, day(-1), 1);
    for (const offset of [-2, -1, 0]) {
      await habits.setCount(readId, day(offset), 1);
    }
    await habits.pause(pausedId);
  });

  it('searches names and notes without regard to case or accents-as-typed', async () => {
    assert.deepEqual(await names('active', { search: 'READ' }), ['Read']);
    assert.deepEqual(await names('active', { search: 'fiction' }), ['Read']);
    assert.deepEqual(await names('active', { search: 'éveil' }), ['Éveil matinal']);
    assert.deepEqual(await names('active', { search: 'zzz' }), []);
  });

  it('filters by period, category and status', async () => {
    assert.deepEqual(await names('active', { period: 'weekly' }), ['Éveil matinal']);
    const [work] = await habits.categories.list();
    assert.ok(work);
    assert.deepEqual(await names('active', { categoryId: work.id }), ['Read']);
    assert.equal((await names('active', { categoryId: '__none__' })).length, 3);
    assert.deepEqual(await names('active', { status: 'done' }), ['Read']);
    assert.deepEqual(await names('active', { status: 'paused' }), ['Paused one']);
    assert.deepEqual(
      (await names('active', { status: 'due' })).sort(),
      ['Gym', 'Éveil matinal'].sort(),
    );
  });

  it('sorts by name, streak and progress in both directions', async () => {
    assert.deepEqual(
      await names('active', {}, { field: 'name', direction: 'asc' }),
      ['Éveil matinal', 'Gym', 'Paused one', 'Read'].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    );
    const byStreak = await names('active', {}, { field: 'streak', direction: 'desc' });
    assert.equal(byStreak[0], 'Read');
    const byProgress = await names('active', {}, { field: 'progress', direction: 'desc' });
    assert.equal(byProgress[0], 'Read');
    assert.equal(
      (await names('active', {}, { field: 'created', direction: 'desc' }))[0],
      'Paused one',
    );
  });

  it("summarises today's overview, ignoring paused habits", async () => {
    assert.deepEqual(todayOverview(await list()), { due: 3, done: 1 });
  });
});

describe('categories', () => {
  it('shares the generic category rules and stays separate from task categories', async () => {
    const ok = await habits.categories.save({ id: null, name: 'Mind', color: '#111' });
    assert.ok(ok.ok);
    assert.equal(
      (await habits.categories.save({ id: null, name: 'mind', color: '#222' })).ok,
      false,
    );

    const taskCategories = createCategoryUseCases(
      new SqliteCategoryRepository(db, 'task', () => now),
    );
    assert.ok((await taskCategories.save({ id: null, name: 'Mind', color: '#333' })).ok);
    assert.equal((await taskCategories.list()).length, 1);
    assert.equal((await habits.categories.list()).length, 1);
  });
});
