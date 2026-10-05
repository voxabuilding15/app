import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { addDaysToKey, toDateKey, weekdayBit } from '@/core';
import { SqliteCategoryRepository } from '@/database/category-repository';
import { SqliteEventRepository } from '@/features/calendar/data/sqlite-event-repository';
import { SqliteHabitAgendaSource } from '@/features/calendar/data/habit-agenda-source';
import { SqliteTaskAgendaSource } from '@/features/calendar/data/task-agenda-source';
import { DEFAULT_CALENDAR_FILTER, type CalendarFilter } from '@/features/calendar/domain/filters';
import type { CalendarItem, EventItem } from '@/features/calendar/domain/items';
import type {
  EventReminderScheduler,
  EventScheduleOutcome,
  ScheduledEventReminder,
} from '@/features/calendar/domain/ports';
import { createCalendarUseCases, type SaveTarget } from '@/features/calendar/domain/usecases';
import type { EventDraft } from '@/features/calendar/domain/validation';

import { createTestDatabase } from '../tasks/test-database';

class FakeScheduler implements EventReminderScheduler {
  active = new Map<string, ScheduledEventReminder>();
  cancelled: string[] = [];
  blocked = false;
  private counter = 0;

  async schedule(reminders: readonly ScheduledEventReminder[]): Promise<EventScheduleOutcome> {
    if (this.blocked) {
      return { status: 'blocked' };
    }
    const ids = reminders.map((reminder) => {
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

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

let now = at(2026, 10, 5, 12); // Monday
let db: ReturnType<typeof createTestDatabase>;
let scheduler: FakeScheduler;
let calendar: ReturnType<typeof createCalendarUseCases>;

beforeEach(() => {
  now = at(2026, 10, 5, 12);
  db = createTestDatabase();
  scheduler = new FakeScheduler();
  const clock = { now: () => now };
  calendar = createCalendarUseCases({
    events: new SqliteEventRepository(db),
    categories: new SqliteCategoryRepository(db, 'event', clock.now),
    tasks: new SqliteTaskAgendaSource(db),
    habits: new SqliteHabitAgendaSource(db),
    reminders: scheduler,
    clock,
  });
});

const draft = (overrides: Partial<EventDraft> = {}): EventDraft => ({
  title: 'Meeting',
  notes: '',
  location: '',
  categoryId: null,
  allDay: false,
  start: at(2026, 10, 6, 9),
  end: at(2026, 10, 6, 10),
  recurrence: null,
  reminderOffsetMinutes: null,
  ...overrides,
});

async function create(overrides: Partial<EventDraft> = {}) {
  const result = await calendar.save(draft(overrides), { kind: 'new' });
  assert.ok(result.ok, 'expected save to succeed');
  return result.id;
}

const range = (from: string, to: string, filter: Partial<CalendarFilter> = {}) =>
  calendar.items(from, to, { ...DEFAULT_CALENDAR_FILTER, ...filter });
const events = async (from: string, to: string, filter: Partial<CalendarFilter> = {}) =>
  (await range(from, to, filter)).filter((i): i is EventItem => i.kind === 'event');
const dates = (items: CalendarItem[]) =>
  items.map((i) => (i.kind === 'event' ? i.occurrenceDate : toDateKey(i.start)));
const daily = { unit: 'day' as const, interval: 1, weekdays: 0, until: null, count: null };

describe('creating and reading events', () => {
  it('persists every field', async () => {
    const cat = await calendar.categories.save({ id: null, name: 'Work', color: '#2563EB' });
    assert.ok(cat.ok);
    const id = await create({
      title: '  Planning  ',
      notes: ' Q4 goals ',
      location: ' Room 4 ',
      categoryId: cat.id,
      reminderOffsetMinutes: 15,
    });
    const entry = await calendar.event(id);
    assert.ok(entry);
    assert.deepEqual(
      { ...entry.event, createdAt: 0, updatedAt: 0 },
      {
        id,
        title: 'Planning',
        notes: 'Q4 goals',
        location: 'Room 4',
        category: { id: cat.id, name: 'Work', color: '#2563EB' },
        start: at(2026, 10, 6, 9),
        end: at(2026, 10, 6, 10),
        allDay: false,
        recurrence: null,
        reminderOffsetMinutes: 15,
        createdAt: 0,
        updatedAt: 0,
      },
    );
  });

  it('rejects invalid drafts without writing anything', async () => {
    const bad = await calendar.save(draft({ title: ' ', end: at(2026, 10, 6, 8) }), {
      kind: 'new',
    });
    assert.ok(!bad.ok && bad.errors.title && bad.errors.time);
    assert.equal((await events('2026-10-01', '2026-10-31')).length, 0);
  });

  it('snaps all-day events to whole days, with the last day inclusive in the draft', async () => {
    const id = await create({
      allDay: true,
      start: at(2026, 10, 6, 15),
      end: at(2026, 10, 8, 3),
    });
    const entry = await calendar.event(id);
    assert.equal(entry?.event.start, at(2026, 10, 6));
    assert.equal(entry?.event.end, at(2026, 10, 8)); // exclusive end at midnight of the 8th = Oct 6-7
    assert.equal((await events('2026-10-07', '2026-10-07')).length, 1);
    assert.equal((await events('2026-10-08', '2026-10-08')).length, 0);
  });

  it('turns a zero-length all-day event into a single day', async () => {
    const id = await create({ allDay: true, start: at(2026, 10, 6), end: at(2026, 10, 6) });
    const entry = await calendar.event(id);
    assert.equal(entry?.event.end, at(2026, 10, 7));
  });

  it('lists events only in the days they fall in', async () => {
    await create();
    assert.equal((await events('2026-10-06', '2026-10-06')).length, 1);
    assert.equal((await events('2026-10-07', '2026-10-31')).length, 0);
    assert.equal((await events('2026-09-01', '2026-10-05')).length, 0);
  });
});

describe('tasks and habits on the calendar', () => {
  function insertTask(
    id: string,
    title: string,
    dueAt: number,
    hasTime: boolean,
    extra: { done?: boolean; archived?: boolean; deleted?: boolean } = {},
  ) {
    db.runSync(
      `INSERT INTO tasks (id,title,priority,due_at,due_has_time,completed_at,archived_at,deleted_at,created_at,updated_at)
       VALUES (?,?,2,?,?,?,?,?,1,1)`,
      [
        id,
        title,
        dueAt,
        hasTime ? 1 : 0,
        extra.done ? 5 : null,
        extra.archived ? 5 : null,
        extra.deleted ? 5 : null,
      ],
    );
  }

  it('shows due tasks, marking timed and all-day ones and skipping archived or deleted ones', async () => {
    insertTask('a', 'Timed', at(2026, 10, 6, 14), true);
    insertTask('b', 'All day', at(2026, 10, 6), false, { done: true });
    insertTask('c', 'Archived', at(2026, 10, 6, 10), true, { archived: true });
    insertTask('d', 'Deleted', at(2026, 10, 6, 11), true, { deleted: true });
    insertTask('e', 'Elsewhere', at(2026, 10, 20, 9), true);

    const items = await range('2026-10-06', '2026-10-06');
    assert.deepEqual(
      items.map((i) => i.title),
      ['All day', 'Timed'],
    );
    const [allDay, timed] = items;
    assert.ok(
      allDay?.kind === 'task' && allDay.allDay && allDay.done && allDay.priority === 'high',
    );
    assert.ok(timed?.kind === 'task' && !timed.allDay && !timed.done);
  });

  function insertHabit(
    id: string,
    name: string,
    period: 'daily' | 'weekly',
    weekdays = 127,
    start = '2026-10-01',
  ) {
    db.runSync(
      `INSERT INTO habits (id,name,icon,color,goal_period,goal_count,weekdays,start_date,created_at)
       VALUES (?,?,'check','#16A34A',?,2,?,?,1)`,
      [id, name, period, weekdays, start],
    );
  }
  const log = (habit: string, date: string, count: number, status = 'done') =>
    db.runSync(`INSERT INTO habit_logs (habit_id,date,count,status) VALUES (?,?,?,?)`, [
      habit,
      date,
      count,
      status,
    ]);

  it('shows daily habits with their status for past, present and future days', async () => {
    insertHabit('h', 'Read', 'daily');
    log('h', '2026-10-03', 2);
    log('h', '2026-10-04', 1);
    log('h', '2026-10-02', 1, 'skipped');
    const items = (await range('2026-10-01', '2026-10-07')).filter((i) => i.kind === 'habit');
    const status = Object.fromEntries(
      items.map((i) => [i.kind === 'habit' ? i.date : '', i.kind === 'habit' ? i.status : '']),
    );
    assert.deepEqual(status, {
      '2026-10-01': 'missed',
      '2026-10-02': 'skipped',
      '2026-10-03': 'done',
      '2026-10-04': 'partial',
      '2026-10-05': 'pending',
      '2026-10-06': 'pending',
      '2026-10-07': 'pending',
    });
  });

  it('shows weekly habits only on days with something logged, and hides paused habits', async () => {
    insertHabit('w', 'Long run', 'weekly');
    log('w', '2026-10-05', 1);
    insertHabit('p', 'Paused', 'daily');
    db.runSync(`INSERT INTO habit_pauses (id,habit_id,start_date) VALUES ('x','p','2026-09-01')`);
    const items = (await range('2026-10-05', '2026-10-09')).filter((i) => i.kind === 'habit');
    assert.deepEqual(
      items.map((i) => i.title),
      ['Long run'],
    );
  });

  it('respects custom weekdays for daily habits', async () => {
    insertHabit('m', 'Gym', 'daily', weekdayBit(1) | weekdayBit(3));
    const items = (await range('2026-10-06', '2026-10-12')).filter((i) => i.kind === 'habit');
    assert.deepEqual(
      items.map((i) => (i.kind === 'habit' ? i.date : '')),
      ['2026-10-07', '2026-10-12'],
    );
  });

  it('skips the queries for kinds that are turned off', async () => {
    insertHabit('h', 'Read', 'daily');
    insertTask('t', 'Pay', at(2026, 10, 6, 9), true);
    await create();
    const only = await range('2026-10-06', '2026-10-06', {
      kinds: { event: true, task: false, habit: false },
    });
    assert.deepEqual(
      only.map((i) => i.kind),
      ['event'],
    );
  });
});

describe('recurring events', () => {
  it('expands a series across a range', async () => {
    await create({ recurrence: { ...daily, count: 5 } });
    assert.deepEqual(dates(await events('2026-10-01', '2026-10-31')), [
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });

  it('editing one occurrence detaches it into a standalone event', async () => {
    const id = await create({ recurrence: daily });
    const target: SaveTarget = {
      kind: 'occurrence',
      id,
      occurrenceDate: '2026-10-08',
      scope: 'this',
    };
    const result = await calendar.save(
      draft({ title: 'Special', start: at(2026, 10, 8, 15), end: at(2026, 10, 8, 16) }),
      target,
    );
    assert.ok(result.ok && result.id !== id);

    const found = await events('2026-10-07', '2026-10-09');
    assert.deepEqual(
      found.map((e) => [e.occurrenceDate, e.title, e.recurring]),
      [
        ['2026-10-07', 'Meeting', true],
        ['2026-10-08', 'Special', false],
        ['2026-10-09', 'Meeting', true],
      ],
    );
  });

  it('editing all occurrences shifts the whole series and keeps its rule', async () => {
    const id = await create({ title: 'Standup', recurrence: daily });
    const result = await calendar.save(
      draft({
        title: 'Daily sync',
        start: at(2026, 10, 8, 10),
        end: at(2026, 10, 8, 10, 30),
        recurrence: daily,
      }),
      { kind: 'occurrence', id, occurrenceDate: '2026-10-08', scope: 'all' },
    );
    assert.ok(result.ok && result.id === id);

    const found = await events('2026-10-06', '2026-10-10');
    assert.equal(found.length, 5);
    assert.ok(found.every((e) => e.title === 'Daily sync'));
    const entry = await calendar.event(id);
    assert.equal(entry?.event.start, at(2026, 10, 6, 10)); // same day, new time
    assert.equal(entry?.event.end, at(2026, 10, 6, 10, 30));
  });

  it('moving the day of one occurrence of a series moves the series start by that many days', async () => {
    const id = await create({ recurrence: { ...daily, until: '2026-10-20' } });
    await calendar.save(
      draft({
        start: at(2026, 10, 9, 9),
        end: at(2026, 10, 9, 10),
        recurrence: { ...daily, until: '2026-10-20' },
      }),
      { kind: 'occurrence', id, occurrenceDate: '2026-10-08', scope: 'all' },
    );
    const entry = await calendar.event(id);
    assert.equal(entry?.event.start, at(2026, 10, 7, 9));
  });

  it('deletes one occurrence or the whole series', async () => {
    const id = await create({ recurrence: { ...daily, count: 4 } });
    await calendar.remove(id, '2026-10-07', 'this');
    assert.deepEqual(dates(await events('2026-10-01', '2026-10-31')), [
      '2026-10-06',
      '2026-10-08',
      '2026-10-09',
    ]);
    await calendar.remove(id, '2026-10-08', 'all');
    assert.equal(await calendar.event(id), null);
    assert.equal((await events('2026-10-01', '2026-10-31')).length, 0);
    assert.equal(
      db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM event_exceptions')?.n,
      0,
    );
  });
});

describe('moving events (drag and drop)', () => {
  it('moves a single event by minutes and days', async () => {
    const id = await create();
    await calendar.move(id, '2026-10-06', { days: 1, minutes: 90 }, 'all');
    const entry = await calendar.event(id);
    assert.equal(entry?.event.start, at(2026, 10, 7, 10, 30));
    assert.equal(entry?.event.end, at(2026, 10, 7, 11, 30));
  });

  it('ignores a zero shift', async () => {
    const id = await create();
    const before = await calendar.event(id);
    await calendar.move(id, '2026-10-06', { days: 0, minutes: 0 }, 'all');
    assert.equal((await calendar.event(id))?.event.updatedAt, before?.event.updatedAt);
  });

  it('moves one occurrence on its own, leaving the rest of the series', async () => {
    const id = await create({ recurrence: daily });
    await calendar.move(id, '2026-10-08', { days: 0, minutes: 120 }, 'this');
    const found = await events('2026-10-07', '2026-10-09');
    assert.deepEqual(
      found.map((e) => [e.occurrenceDate, new Date(e.start).getHours()]),
      [
        ['2026-10-07', 9],
        ['2026-10-08', 11],
        ['2026-10-09', 9],
      ],
    );
  });

  it('moves the whole series when asked', async () => {
    const id = await create({ recurrence: daily });
    await calendar.move(id, '2026-10-08', { days: 0, minutes: -60 }, 'all');
    const found = await events('2026-10-07', '2026-10-08');
    assert.ok(found.every((e) => new Date(e.start).getHours() === 8));
  });

  it('keeps an all-day event all-day when moved by days', async () => {
    const id = await create({ allDay: true, start: at(2026, 10, 6), end: at(2026, 10, 7) });
    await calendar.move(id, '2026-10-06', { days: 3, minutes: 0 }, 'all');
    const entry = await calendar.event(id);
    assert.equal(entry?.event.start, at(2026, 10, 9));
    assert.equal(entry?.event.end, at(2026, 10, 10));
  });

  it('fails clearly for an event that no longer exists', async () => {
    await assert.rejects(
      () => calendar.move('missing', '2026-10-06', { days: 1, minutes: 0 }, 'all'),
      /no longer exists/,
    );
  });
});

describe('reminders', () => {
  it('schedules a reminder before a future event and not for past ones', async () => {
    await create({ reminderOffsetMinutes: 30 });
    assert.equal(scheduler.active.size, 1);
    assert.equal([...scheduler.active.values()][0]?.fireAt, at(2026, 10, 6, 8, 30));

    await create({
      title: 'Past',
      start: at(2026, 10, 1, 9),
      end: at(2026, 10, 1, 10),
      reminderOffsetMinutes: 30,
    });
    assert.equal(scheduler.active.size, 1);
  });

  it('plans only the next dozen reminders of a series within a month', async () => {
    await create({ recurrence: daily, reminderOffsetMinutes: 0 });
    assert.equal(scheduler.active.size, 12);
    const fires = [...scheduler.active.values()].map((r) => r.fireAt).sort((a, b) => a - b);
    assert.equal(fires[0], at(2026, 10, 6, 9));
    assert.equal(fires[11], at(2026, 10, 17, 9));
  });

  it('reminds all-day events at 9:00', async () => {
    await create({
      allDay: true,
      start: at(2026, 10, 8),
      end: at(2026, 10, 9),
      reminderOffsetMinutes: 1440,
    });
    assert.equal([...scheduler.active.values()][0]?.fireAt, at(2026, 10, 7, 9));
  });

  it('replaces reminders on edit and cancels them on delete', async () => {
    const id = await create({ reminderOffsetMinutes: 30 });
    await calendar.save(draft({ reminderOffsetMinutes: 5 }), { kind: 'event', id });
    assert.equal(scheduler.active.size, 1);
    assert.equal([...scheduler.active.values()][0]?.fireAt, at(2026, 10, 6, 8, 55));
    await calendar.remove(id, '2026-10-06', 'all');
    assert.equal(scheduler.active.size, 0);
  });

  it('cancels the reminder of a deleted occurrence', async () => {
    const id = await create({ recurrence: { ...daily, count: 3 }, reminderOffsetMinutes: 0 });
    assert.equal(scheduler.active.size, 3);
    await calendar.remove(id, '2026-10-07', 'this');
    assert.equal(scheduler.active.size, 2);
  });

  it('reports blocked notifications but still saves the event', async () => {
    scheduler.blocked = true;
    const result = await calendar.save(draft({ reminderOffsetMinutes: 15 }), { kind: 'new' });
    assert.ok(result.ok && result.reminder === 'blocked');
    assert.equal((await events('2026-10-06', '2026-10-06')).length, 1);
  });

  it('refreshes the rolling window as time passes', async () => {
    await create({ recurrence: daily, reminderOffsetMinutes: 0 });
    now = at(2026, 10, 20, 12);
    await calendar.refreshReminders();
    const fires = [...scheduler.active.values()].map((r) => r.fireAt).sort((a, b) => a - b);
    assert.equal(scheduler.active.size, 12);
    assert.equal(fires[0], at(2026, 10, 21, 9));
  });
});

describe('filters and search', () => {
  beforeEach(async () => {
    const work = await calendar.categories.save({ id: null, name: 'Work', color: '#2563EB' });
    assert.ok(work.ok);
    await create({ title: 'Standup', location: 'Room 4', categoryId: work.id });
    await create({
      title: 'Lunch',
      notes: 'with Sam',
      start: at(2026, 10, 6, 12),
      end: at(2026, 10, 6, 13),
    });
    db.runSync(
      `INSERT INTO tasks (id,title,priority,due_at,due_has_time,created_at,updated_at) VALUES ('t','Pay rent',1,?,1,1,1)`,
      [at(2026, 10, 6, 17)],
    );
  });

  it('filters events by category while leaving tasks alone', async () => {
    const [work] = await calendar.categories.list();
    const titles = (await range('2026-10-06', '2026-10-06', { categoryId: work!.id })).map(
      (i) => i.title,
    );
    assert.deepEqual(titles, ['Standup', 'Pay rent']);
    const none = (await range('2026-10-06', '2026-10-06', { categoryId: '__none__' })).map(
      (i) => i.title,
    );
    assert.deepEqual(none, ['Lunch', 'Pay rent']);
  });

  it('searches across kinds in a window around today', async () => {
    const found = async (search: string) =>
      (await calendar.search({ ...DEFAULT_CALENDAR_FILTER, search })).map((i) => i.title);
    assert.deepEqual(await found('room'), ['Standup']);
    assert.deepEqual(await found('sam'), ['Lunch']);
    assert.deepEqual(await found('rent'), ['Pay rent']);
    assert.deepEqual(await found('zzz'), []);
  });

  it('limits search results and keeps them in date order', async () => {
    await create({ title: 'Standup repeat', recurrence: daily });
    const results = await calendar.search({ ...DEFAULT_CALENDAR_FILTER, search: 'standup' });
    assert.equal(results.length, 200);
    const starts = results.map((r) => r.start);
    assert.deepEqual(
      starts,
      [...starts].sort((a, b) => a - b),
    );
  });
});

describe('event categories', () => {
  it('are separate from task and habit categories and detach on delete', async () => {
    const cat = await calendar.categories.save({ id: null, name: 'Home', color: '#16A34A' });
    assert.ok(cat.ok);
    assert.equal(
      (await calendar.categories.save({ id: null, name: 'home', color: '#000' })).ok,
      false,
    );
    const id = await create({ categoryId: cat.id });
    await calendar.categories.delete(cat.id);
    assert.equal((await calendar.event(id))?.event.category, null);
    assert.equal(addDaysToKey('2026-10-06', 0), '2026-10-06');
  });
});
