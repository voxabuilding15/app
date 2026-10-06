import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toDateKey, weekdayBit, type DateKey } from '@/core';
import type {
  CalendarEvent,
  EventEntry,
  EventRecurrence,
} from '@/features/calendar/domain/entities';
import {
  DEFAULT_CALENDAR_FILTER,
  countActiveCalendarFilters,
  filterItems,
} from '@/features/calendar/domain/filters';
import {
  allDayItemsOn,
  eventItemFrom,
  itemsOnDay,
  sortItems,
  timedItemsOn,
  type CalendarItem,
  type HabitItem,
  type TaskItem,
} from '@/features/calendar/domain/items';
import { expandEvent, occurrenceForDay } from '@/features/calendar/domain/occurrences';
import {
  dragToShift,
  isNoShift,
  layoutTimeline,
  shiftTime,
} from '@/features/calendar/domain/timeline';
import {
  EVENT_TITLE_MAX_LENGTH,
  eventReminderOffsetsFor,
  hasEventErrors,
  validateEventDraft,
  type EventDraft,
} from '@/features/calendar/domain/validation';
import { monthGrid, stepAnchor, visibleRange, weekDays } from '@/features/calendar/domain/views';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const midnight = (y: number, m: number, d: number) => at(y, m, d);

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e',
    title: 'Event',
    notes: '',
    location: '',
    category: null,
    start: at(2026, 10, 5, 9),
    end: at(2026, 10, 5, 10),
    allDay: false,
    recurrence: null,
    reminderOffsetMinutes: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const rule = (r: Partial<EventRecurrence> & Pick<EventRecurrence, 'unit'>): EventRecurrence => ({
  interval: 1,
  weekdays: 0,
  until: null,
  count: null,
  ...r,
});

const entry = (e: CalendarEvent, exceptions: DateKey[] = []): EventEntry => ({
  event: e,
  exceptions,
  notificationIds: [],
});

const days = (occurrences: ReturnType<typeof expandEvent>) =>
  occurrences.map((o) => o.occurrenceDate);

describe('expandEvent', () => {
  it('returns a single event only inside its range', () => {
    const e = entry(event());
    assert.equal(expandEvent(e, at(2026, 10, 5), at(2026, 10, 6)).length, 1);
    assert.equal(expandEvent(e, at(2026, 10, 6), at(2026, 10, 7)).length, 0);
    assert.equal(expandEvent(e, at(2026, 10, 5, 10), at(2026, 10, 6)).length, 0); // end is exclusive
  });

  it('includes events that cross midnight in both days', () => {
    const e = entry(event({ start: at(2026, 10, 5, 22), end: at(2026, 10, 6, 2) }));
    assert.equal(expandEvent(e, at(2026, 10, 6), at(2026, 10, 7)).length, 1);
  });

  it('repeats daily with an interval', () => {
    const e = entry(event({ recurrence: rule({ unit: 'day', interval: 2 }) }));
    const found = expandEvent(e, at(2026, 10, 5), at(2026, 10, 12));
    assert.deepEqual(days(found), ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11']);
    assert.equal(new Date(found[1]!.start).getHours(), 9);
  });

  it('repeats weekly on chosen weekdays, always including the start day', () => {
    const mwf = weekdayBit(1) | weekdayBit(3) | weekdayBit(5);
    const e = entry(event({ recurrence: rule({ unit: 'week', weekdays: mwf }) }));
    assert.deepEqual(days(expandEvent(e, at(2026, 10, 5), at(2026, 10, 13))), [
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
    ]);
    const tuesdayStart = entry(
      event({
        start: at(2026, 10, 6, 9),
        end: at(2026, 10, 6, 10),
        recurrence: rule({ unit: 'week', weekdays: mwf }),
      }),
    );
    assert.equal(
      days(expandEvent(tuesdayStart, at(2026, 10, 5), at(2026, 10, 9)))[0],
      '2026-10-06',
    );
  });

  it('keeps monthly repeats anchored to the start day instead of drifting', () => {
    const e = entry(
      event({
        start: at(2027, 1, 31, 9),
        end: at(2027, 1, 31, 10),
        recurrence: rule({ unit: 'month' }),
      }),
    );
    assert.deepEqual(days(expandEvent(e, at(2027, 1, 1), at(2027, 5, 1))), [
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });

  it('repeats yearly and clamps 29 February', () => {
    const e = entry(
      event({
        start: at(2028, 2, 29, 9),
        end: at(2028, 2, 29, 10),
        recurrence: rule({ unit: 'year' }),
      }),
    );
    assert.deepEqual(days(expandEvent(e, at(2028, 1, 1), at(2033, 1, 1))), [
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
    ]);
  });

  it('stops at an end date (inclusive) or after a count', () => {
    const until = entry(event({ recurrence: rule({ unit: 'day', until: '2026-10-07' }) }));
    assert.deepEqual(days(expandEvent(until, at(2026, 10, 1), at(2026, 12, 1))), [
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    const counted = entry(event({ recurrence: rule({ unit: 'day', count: 3 }) }));
    assert.equal(expandEvent(counted, at(2026, 10, 1), at(2027, 10, 1)).length, 3);
  });

  it('skips exceptions but still counts them towards a limited series', () => {
    const e = entry(event({ recurrence: rule({ unit: 'day', count: 4 }) }), ['2026-10-06']);
    assert.deepEqual(days(expandEvent(e, at(2026, 10, 1), at(2026, 12, 1))), [
      '2026-10-05',
      '2026-10-07',
      '2026-10-08',
    ]);
  });

  it('only returns occurrences that overlap the requested range', () => {
    const e = entry(event({ recurrence: rule({ unit: 'day' }) }));
    const found = expandEvent(e, at(2026, 12, 25), at(2026, 12, 27));
    assert.deepEqual(days(found), ['2026-12-25', '2026-12-26']);
  });

  it('keeps wall-clock time across a daylight-saving change', () => {
    const e = entry(
      event({
        start: at(2026, 3, 1, 9),
        end: at(2026, 3, 1, 10),
        recurrence: rule({ unit: 'day' }),
      }),
    );
    for (const o of expandEvent(e, at(2026, 3, 1), at(2026, 4, 15))) {
      assert.equal(new Date(o.start).getHours(), 9, o.occurrenceDate);
      assert.equal(new Date(o.end).getHours(), 10, o.occurrenceDate);
    }
  });

  it('expands multi-day all-day events across their whole span', () => {
    const e = entry(
      event({
        allDay: true,
        start: midnight(2026, 10, 5),
        end: midnight(2026, 10, 8), // Oct 5-7
        recurrence: rule({ unit: 'week' }),
      }),
    );
    const found = expandEvent(e, at(2026, 10, 12), at(2026, 10, 13));
    assert.deepEqual(days(found), ['2026-10-12']);
    assert.equal(found[0]?.start, midnight(2026, 10, 12));
    assert.equal(found[0]?.end, midnight(2026, 10, 15));
    assert.deepEqual(days(expandEvent(e, at(2026, 10, 14), at(2026, 10, 15))), ['2026-10-12']); // still running
  });

  it('finds the occurrence on a given day', () => {
    const e = entry(event({ recurrence: rule({ unit: 'week' }) }));
    assert.equal(occurrenceForDay(e, '2026-10-12')?.occurrenceDate, '2026-10-12');
    assert.equal(occurrenceForDay(e, '2026-10-13'), null);
  });
});

const taskItem = (over: Partial<TaskItem> = {}): TaskItem => ({
  kind: 'task',
  key: 't',
  taskId: 't',
  title: 'Task',
  start: at(2026, 10, 5, 12),
  end: at(2026, 10, 5, 12),
  allDay: false,
  color: null,
  done: false,
  priority: 'medium',
  ...over,
});
const habitItem = (over: Partial<HabitItem> = {}): HabitItem => ({
  kind: 'habit',
  key: 'h',
  habitId: 'h',
  title: 'Habit',
  icon: 'x',
  date: '2026-10-05',
  status: 'pending',
  count: 0,
  goal: 1,
  start: midnight(2026, 10, 5),
  end: midnight(2026, 10, 6),
  allDay: true,
  color: null,
  ...over,
});

describe('items', () => {
  it('sorts all-day first, then by time, then events before tasks before habits', () => {
    const ev = eventItemFrom({
      event: event({ title: 'Meeting' }),
      occurrenceDate: '2026-10-05',
      start: at(2026, 10, 5, 12),
      end: at(2026, 10, 5, 13),
    });
    const sorted = sortItems([
      taskItem(),
      habitItem(),
      ev,
      taskItem({ key: 't2', start: at(2026, 10, 5, 8), end: at(2026, 10, 5, 8), title: 'Early' }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.title),
      ['Habit', 'Early', 'Meeting', 'Task'],
    );
  });

  it('selects items per day, splitting all-day from timed', () => {
    const night = eventItemFrom({
      event: event({ title: 'Night' }),
      occurrenceDate: '2026-10-05',
      start: at(2026, 10, 5, 22),
      end: at(2026, 10, 6, 2),
    });
    const items: CalendarItem[] = [night, habitItem(), taskItem()];
    assert.equal(itemsOnDay(items, '2026-10-05').length, 3);
    assert.deepEqual(
      itemsOnDay(items, '2026-10-06').map((i) => i.title),
      ['Night'],
    );
    assert.deepEqual(
      allDayItemsOn(items, '2026-10-05').map((i) => i.title),
      ['Habit'],
    );
    assert.deepEqual(
      timedItemsOn(items, '2026-10-05').map((i) => i.title),
      ['Task', 'Night'],
    );
    assert.equal(itemsOnDay(items, '2026-10-07').length, 0);
  });
});

describe('views', () => {
  it('builds whole Monday-first weeks for a month', () => {
    const grid = monthGrid('2026-10-15');
    assert.equal(grid.length, 5);
    assert.equal(grid[0]![0]!.day, '2026-09-28');
    assert.equal(grid[0]![0]!.inMonth, false);
    assert.equal(grid[0]![3]!.day, '2026-10-01');
    assert.equal(grid[0]![3]!.inMonth, true);
    assert.equal(grid[4]![6]!.day, '2026-11-01');
    assert.ok(grid.every((row) => row.length === 7));
  });

  it('needs six rows for some months and four for a 28-day February starting on Monday', () => {
    assert.equal(monthGrid('2027-02-10').length, 4);
    assert.equal(monthGrid('2026-02-10').length, 5);
    assert.equal(monthGrid('2026-08-10').length, 6);
  });

  it('computes visible ranges per view', () => {
    assert.deepEqual(visibleRange('day', '2026-10-07'), { from: '2026-10-07', to: '2026-10-07' });
    assert.deepEqual(visibleRange('week', '2026-10-07'), { from: '2026-10-05', to: '2026-10-11' });
    assert.deepEqual(visibleRange('month', '2026-10-07'), { from: '2026-09-28', to: '2026-11-01' });
    assert.deepEqual(visibleRange('agenda', '2026-10-07'), {
      from: '2026-10-07',
      to: '2026-11-05',
    });
    assert.equal(weekDays('2026-10-11')[0], '2026-10-05');
  });

  it('steps the anchor by view, clamping month ends', () => {
    assert.equal(stepAnchor('month', '2026-01-31', 1), '2026-02-28');
    assert.equal(stepAnchor('month', '2026-03-31', -1), '2026-02-28');
    assert.equal(stepAnchor('week', '2026-10-07', -1), '2026-09-30');
    assert.equal(stepAnchor('day', '2026-12-31', 1), '2027-01-01');
    assert.equal(stepAnchor('agenda', '2026-10-07', 1), '2026-11-06');
  });
});

const timed = (
  title: string,
  sh: number,
  sm: number,
  eh: number,
  em: number,
  day = 5,
): CalendarItem =>
  eventItemFrom({
    event: event({ id: title, title }),
    occurrenceDate: `2026-10-${String(day).padStart(2, '0')}`,
    start: at(2026, 10, day, sh, sm),
    end: at(2026, 10, day, eh, em),
  });

describe('layoutTimeline', () => {
  it('places a lone event at full width', () => {
    const [block] = layoutTimeline([timed('A', 9, 0, 10, 30)], '2026-10-05');
    assert.deepEqual(
      [block?.startMinutes, block?.endMinutes, block?.column, block?.columns],
      [540, 630, 0, 1],
    );
  });

  it('puts overlapping events in side-by-side lanes', () => {
    const blocks = layoutTimeline(
      [timed('A', 9, 0, 11, 0), timed('B', 10, 0, 12, 0), timed('C', 10, 30, 11, 30)],
      '2026-10-05',
    );
    const by = Object.fromEntries(blocks.map((b) => [b.item.title, [b.column, b.columns]]));
    assert.deepEqual(by, { A: [0, 3], B: [1, 3], C: [2, 3] });
  });

  it('reuses a lane once an earlier event has finished', () => {
    const blocks = layoutTimeline(
      [timed('A', 9, 0, 10, 0), timed('B', 9, 30, 11, 0), timed('C', 10, 0, 10, 45)],
      '2026-10-05',
    );
    const by = Object.fromEntries(blocks.map((b) => [b.item.title, [b.column, b.columns]]));
    assert.deepEqual(by, { A: [0, 2], B: [1, 2], C: [0, 2] });
  });

  it('keeps separate groups independent', () => {
    const blocks = layoutTimeline(
      [timed('A', 9, 0, 10, 0), timed('B', 14, 0, 15, 0)],
      '2026-10-05',
    );
    assert.ok(blocks.every((b) => b.columns === 1 && b.column === 0));
  });

  it('gives short events a minimum height and clips multi-day events to the day', () => {
    const [short] = layoutTimeline([timed('Quick', 9, 0, 9, 5)], '2026-10-05');
    assert.equal((short?.endMinutes ?? 0) - (short?.startMinutes ?? 0), 30);

    const night = eventItemFrom({
      event: event({ title: 'Night' }),
      occurrenceDate: '2026-10-05',
      start: at(2026, 10, 5, 22),
      end: at(2026, 10, 7, 2),
    });
    assert.deepEqual(
      [
        layoutTimeline([night], '2026-10-05')[0]?.startMinutes,
        layoutTimeline([night], '2026-10-05')[0]?.endMinutes,
      ],
      [1320, 1440],
    );
    assert.deepEqual(
      [
        layoutTimeline([night], '2026-10-06')[0]?.startMinutes,
        layoutTimeline([night], '2026-10-06')[0]?.endMinutes,
      ],
      [0, 1440],
    );
    assert.deepEqual(
      [
        layoutTimeline([night], '2026-10-07')[0]?.startMinutes,
        layoutTimeline([night], '2026-10-07')[0]?.endMinutes,
      ],
      [0, 120],
    );
  });

  it('keeps late events inside the day and ignores all-day items', () => {
    const [late] = layoutTimeline([timed('Late', 23, 50, 23, 59)], '2026-10-05');
    assert.equal(late?.endMinutes, 1440);
    assert.ok((late?.startMinutes ?? 0) <= 1410);
    assert.equal(layoutTimeline([habitItem()], '2026-10-05').length, 0);
  });
});

describe('drag math', () => {
  const metrics = { columnWidth: 100, hourHeight: 60 };

  it('snaps vertical drags to 15 minutes and converts horizontal drags to whole days', () => {
    assert.deepEqual(dragToShift(0, 60, metrics), { days: 0, minutes: 60 });
    // With the layout read right to left, a drag to the right goes to the earlier day.
    assert.deepEqual(dragToShift(2 * metrics.columnWidth, 0, { ...metrics, reverseDays: true }), {
      days: -2,
      minutes: 0,
    });
    assert.deepEqual(dragToShift(-metrics.columnWidth, 0, { ...metrics, reverseDays: true }), {
      days: 1,
      minutes: 0,
    });
    assert.deepEqual(dragToShift(0, 22, metrics), { days: 0, minutes: 15 });
    assert.deepEqual(dragToShift(0, 7, metrics), { days: 0, minutes: 0 });
    assert.deepEqual(dragToShift(0, -37, metrics), { days: 0, minutes: -30 });
    assert.deepEqual(dragToShift(160, 0, metrics), { days: 2, minutes: 0 });
    assert.deepEqual(dragToShift(-140, 30, metrics), { days: -1, minutes: 30 });
  });

  it('ignores horizontal movement in single-day views', () => {
    assert.deepEqual(dragToShift(500, 0, { columnWidth: 0, hourHeight: 60 }), {
      days: 0,
      minutes: 0,
    });
    assert.ok(isNoShift(dragToShift(10, 3, metrics)));
  });

  it('shifts times keeping the wall clock across daylight-saving changes', () => {
    const moved = shiftTime(at(2026, 3, 7, 9), { days: 2, minutes: 30 });
    assert.deepEqual(
      [new Date(moved).getDate(), new Date(moved).getHours(), new Date(moved).getMinutes()],
      [9, 9, 30],
    );
    assert.equal(
      toDateKey(shiftTime(at(2026, 10, 31, 23), { days: 0, minutes: 90 })),
      '2026-11-01',
    );
  });
});

describe('filters', () => {
  const work = eventItemFrom({
    event: event({
      title: 'Standup',
      location: 'Room 4',
      category: { id: 'c1', name: 'Work', color: '#111' },
    }),
    occurrenceDate: '2026-10-05',
    start: at(2026, 10, 5, 9),
    end: at(2026, 10, 5, 10),
  });
  const plain = eventItemFrom({
    event: event({ id: 'p', title: 'Lunch', notes: 'with Sam' }),
    occurrenceDate: '2026-10-05',
    start: at(2026, 10, 5, 12),
    end: at(2026, 10, 5, 13),
  });
  const items: CalendarItem[] = [
    work,
    plain,
    taskItem({ title: 'Pay rent' }),
    habitItem({ title: 'Read' }),
  ];
  const titles = (f: Partial<typeof DEFAULT_CALENDAR_FILTER>) =>
    filterItems(items, { ...DEFAULT_CALENDAR_FILTER, ...f }).map((i) => i.title);

  it('hides kinds the user turned off', () => {
    assert.equal(titles({}).length, 4);
    assert.deepEqual(titles({ kinds: { event: true, task: false, habit: false } }), [
      'Standup',
      'Lunch',
    ]);
    assert.deepEqual(titles({ kinds: { event: false, task: true, habit: true } }), [
      'Pay rent',
      'Read',
    ]);
  });

  it('limits events by category without hiding tasks and habits', () => {
    assert.deepEqual(titles({ categoryId: 'c1' }), ['Standup', 'Pay rent', 'Read']);
    assert.deepEqual(titles({ categoryId: '__none__' }), ['Lunch', 'Pay rent', 'Read']);
  });

  it('searches titles, locations and notes case-insensitively', () => {
    assert.deepEqual(titles({ search: 'ROOM' }), ['Standup']);
    assert.deepEqual(titles({ search: 'sam' }), ['Lunch']);
    assert.deepEqual(titles({ search: 'rent' }), ['Pay rent']);
    assert.deepEqual(titles({ search: 'zzz' }), []);
  });

  it('counts active filters', () => {
    assert.equal(countActiveCalendarFilters(DEFAULT_CALENDAR_FILTER), 0);
    assert.equal(
      countActiveCalendarFilters({
        ...DEFAULT_CALENDAR_FILTER,
        kinds: { event: true, task: false, habit: false },
        categoryId: 'x',
      }),
      3,
    );
  });
});

describe('validateEventDraft', () => {
  const draft = (over: Partial<EventDraft> = {}): EventDraft => ({
    title: 'Dentist',
    notes: '',
    location: '',
    categoryId: null,
    allDay: false,
    start: at(2026, 10, 5, 9),
    end: at(2026, 10, 5, 10),
    recurrence: null,
    reminderOffsetMinutes: null,
    ...over,
  });

  it('accepts a valid event', () => {
    assert.equal(hasEventErrors(validateEventDraft(draft())), false);
  });

  it('requires a title within the limit', () => {
    assert.ok(validateEventDraft(draft({ title: ' ' })).title);
    assert.ok(validateEventDraft(draft({ title: 'x'.repeat(EVENT_TITLE_MAX_LENGTH + 1) })).title);
  });

  it('requires the end to be after the start', () => {
    assert.ok(validateEventDraft(draft({ end: at(2026, 10, 5, 9) })).time);
    assert.ok(validateEventDraft(draft({ end: at(2026, 10, 5, 8) })).time);
  });

  it('validates repeat rules and their end conditions', () => {
    const base = rule({ unit: 'day' });
    assert.equal(validateEventDraft(draft({ recurrence: base })).repeat, undefined);
    assert.ok(validateEventDraft(draft({ recurrence: { ...base, interval: 0 } })).repeat);
    assert.ok(validateEventDraft(draft({ recurrence: { ...base, interval: 366 } })).repeat);
    assert.ok(validateEventDraft(draft({ recurrence: { ...base, until: '2026-10-01' } })).repeat);
    assert.equal(
      validateEventDraft(draft({ recurrence: { ...base, until: '2026-10-05' } })).repeat,
      undefined,
    );
    assert.ok(validateEventDraft(draft({ recurrence: { ...base, count: 0 } })).repeat);
    assert.ok(
      validateEventDraft(draft({ recurrence: { ...base, until: '2026-12-01', count: 3 } })).repeat,
    );
  });

  it('only allows reminder offsets that fit the event kind', () => {
    assert.equal(validateEventDraft(draft({ reminderOffsetMinutes: 15 })).reminder, undefined);
    assert.ok(validateEventDraft(draft({ reminderOffsetMinutes: 7 })).reminder);
    assert.ok(
      validateEventDraft(
        draft({
          allDay: true,
          start: midnight(2026, 10, 5),
          end: midnight(2026, 10, 6),
          reminderOffsetMinutes: 15,
        }),
      ).reminder,
    );
    assert.deepEqual(eventReminderOffsetsFor(true), [0, 1440]);
  });
});
