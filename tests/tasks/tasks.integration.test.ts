import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { SqliteTaskRepository } from '@/features/tasks/data/sqlite-task-repository';
import { SqliteTaxonomyRepository } from '@/features/tasks/data/sqlite-taxonomy-repository';
import {
  NO_CATEGORY,
  DEFAULT_FILTER,
  defaultSortFor,
  type TaskFilter,
  type TaskSort,
} from '@/features/tasks/domain/filters';
import type {
  ReminderScheduler,
  ScheduledReminder,
  ScheduleOutcome,
} from '@/features/tasks/domain/ports';
import { createTaskUseCases, createTaxonomyUseCases } from '@/features/tasks/domain/usecases';
import { emptyDraft, type TaskDraft } from '@/features/tasks/domain/validation';

import { createTestDatabase } from './test-database';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

class FakeScheduler implements ReminderScheduler {
  scheduled = new Map<string, ScheduledReminder>();
  cancelled: string[] = [];
  blocked = false;
  private counter = 0;

  async schedule(reminder: ScheduledReminder): Promise<ScheduleOutcome> {
    if (this.blocked) {
      return { status: 'blocked' };
    }
    this.counter += 1;
    const id = `n${this.counter}`;
    this.scheduled.set(id, reminder);
    return { status: 'scheduled', notificationId: id };
  }

  async cancel(id: string) {
    this.cancelled.push(id);
    this.scheduled.delete(id);
  }
}

let now = at(2026, 10, 5, 12, 0);
let scheduler: FakeScheduler;
let tasks: ReturnType<typeof createTaskUseCases>;
let taxonomy: ReturnType<typeof createTaxonomyUseCases>;

beforeEach(() => {
  now = at(2026, 10, 5, 12, 0);
  const db = createTestDatabase();
  scheduler = new FakeScheduler();
  const clock = { now: () => now };
  tasks = createTaskUseCases({
    tasks: new SqliteTaskRepository(db),
    taxonomy: new SqliteTaxonomyRepository(db, clock.now),
    reminders: scheduler,
    clock,
  });
  taxonomy = createTaxonomyUseCases({ taxonomy: new SqliteTaxonomyRepository(db, clock.now) });
});

const draft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  ...emptyDraft(),
  title: 'Task',
  ...overrides,
});

async function create(overrides: Partial<TaskDraft> = {}) {
  const result = await tasks.save(draft(overrides), null);
  assert.ok(result.ok, 'expected save to succeed');
  return result.id;
}

const list = (filter: Partial<TaskFilter> = {}, sort?: TaskSort) => {
  const merged = { ...DEFAULT_FILTER, ...filter };
  return tasks.list(merged, sort ?? defaultSortFor(merged.scope), 200);
};
const titles = async (filter: Partial<TaskFilter> = {}, sort?: TaskSort) =>
  (await list(filter, sort)).map((task) => task.title);

describe('create, read, update', () => {
  it('persists every field including subtasks, labels and category', async () => {
    const cat = await taxonomy.saveCategory({ id: null, name: 'Work', color: '#111111' });
    const label = await taxonomy.saveLabel({ id: null, name: 'Urgent', color: '#222222' });
    assert.ok(cat.ok && label.ok);

    const id = await create({
      title: '  Write report  ',
      notes: 'Quarterly numbers',
      priority: 'high',
      categoryId: cat.id,
      labelIds: [label.id],
      due: { at: at(2026, 10, 6, 17, 30), hasTime: true },
      reminderOffsetMinutes: 30,
      isAlarm: true,
      repeat: { unit: 'week', interval: 2, weekdays: 0b0101010 },
      subtasks: [
        { id: null, title: 'Draft', completed: false },
        { id: null, title: '   ', completed: false },
        { id: null, title: 'Review', completed: true },
      ],
    });

    const task = await tasks.get(id);
    assert.ok(task);
    assert.equal(task.title, 'Write report');
    assert.equal(task.notes, 'Quarterly numbers');
    assert.equal(task.priority, 'high');
    assert.equal(task.category?.name, 'Work');
    assert.deepEqual(
      task.labels.map((l) => l.name),
      ['Urgent'],
    );
    assert.deepEqual(task.due, { at: at(2026, 10, 6, 17, 30), hasTime: true });
    assert.equal(task.reminderAt, at(2026, 10, 6, 17, 0));
    assert.equal(task.isAlarm, true);
    assert.deepEqual(task.repeat, { unit: 'week', interval: 2, weekdays: 0b0101010 });
    assert.deepEqual(
      task.subtasks.map((s) => [s.title, s.completed]),
      [
        ['Draft', false],
        ['Review', true],
      ],
    );
    assert.equal(task.subtaskTotal, 2);
    assert.equal(task.subtaskDone, 1);
  });

  it('rejects invalid drafts without writing anything', async () => {
    const result = await tasks.save(draft({ title: '' }), null);
    assert.equal(result.ok, false);
    assert.equal((await list()).length, 0);
  });

  it('drops reminder, alarm and repeat when the due date is cleared', async () => {
    const id = await create({
      due: { at: at(2026, 10, 6, 9), hasTime: true },
      reminderOffsetMinutes: 0,
      isAlarm: true,
      repeat: { unit: 'day', interval: 1, weekdays: 0 },
    });
    const existing = await tasks.get(id);
    assert.ok(existing);
    const result = await tasks.save(
      draft({ title: 'Task', due: null, reminderOffsetMinutes: 0 }),
      id,
    );
    assert.equal(result.ok, false); // reminder without due is a validation error
    await tasks.save(draft({ title: 'Task', due: null }), id);
    const updated = await tasks.get(id);
    assert.equal(updated?.due, null);
    assert.equal(updated?.reminderAt, null);
    assert.equal(updated?.repeat, null);
    assert.equal(updated?.isAlarm, false);
  });

  it('preserves subtask identity on edit and removes dropped ones', async () => {
    const id = await create({
      subtasks: [
        { id: null, title: 'A', completed: false },
        { id: null, title: 'B', completed: false },
      ],
    });
    const before = await tasks.get(id);
    assert.ok(before);
    const [a] = before.subtasks;
    assert.ok(a);
    await tasks.save(
      draft({
        subtasks: [
          { id: a.id, title: 'A renamed', completed: true },
          { id: null, title: 'C', completed: false },
        ],
      }),
      id,
    );
    const after = await tasks.get(id);
    assert.deepEqual(
      after?.subtasks.map((s) => s.title),
      ['A renamed', 'C'],
    );
    assert.equal(after?.subtasks[0]?.id, a.id);
    assert.equal(after?.subtasks[0]?.completed, true);
  });

  it('toggles a single subtask', async () => {
    const id = await create({ subtasks: [{ id: null, title: 'A', completed: false }] });
    const sub = (await tasks.get(id))?.subtasks[0];
    assert.ok(sub);
    await tasks.toggleSubtask(id, sub.id, true);
    assert.equal((await tasks.get(id))?.subtaskDone, 1);
  });
});

describe('search, filter and sort', () => {
  beforeEach(async () => {
    const cat = await taxonomy.saveCategory({ id: null, name: 'Home', color: '#000' });
    const label = await taxonomy.saveLabel({ id: null, name: 'Errand', color: '#000' });
    assert.ok(cat.ok && label.ok);
    await create({
      title: 'Buy milk',
      priority: 'low',
      categoryId: cat.id,
      labelIds: [label.id],
      due: { at: at(2026, 10, 5, 18), hasTime: true },
    });
    await create({
      title: 'Pay 100% of rent',
      priority: 'high',
      due: { at: at(2026, 10, 3), hasTime: false },
    });
    await create({
      title: 'Plan trip',
      priority: 'medium',
      notes: 'book flights',
      due: { at: at(2026, 10, 20), hasTime: false },
    });
    await create({
      title: 'Someday',
      priority: 'medium',
      subtasks: [{ id: null, title: 'Read manual', completed: false }],
    });
  });

  it('searches title, notes and subtasks, treating wildcards literally', async () => {
    assert.deepEqual(await titles({ search: 'MILK' }), ['Buy milk']);
    assert.deepEqual(await titles({ search: 'flights' }), ['Plan trip']);
    assert.deepEqual(await titles({ search: 'manual' }), ['Someday']);
    assert.deepEqual(await titles({ search: '100%' }), ['Pay 100% of rent']);
    assert.deepEqual(await titles({ search: '%' }), ['Pay 100% of rent']);
    assert.deepEqual(await titles({ search: '_' }), []);
  });

  it('sorts by due date with undated tasks last, in both directions', async () => {
    assert.deepEqual(await titles({}, { field: 'due', direction: 'asc' }), [
      'Pay 100% of rent',
      'Buy milk',
      'Plan trip',
      'Someday',
    ]);
    assert.deepEqual(await titles({}, { field: 'due', direction: 'desc' }), [
      'Plan trip',
      'Buy milk',
      'Pay 100% of rent',
      'Someday',
    ]);
  });

  it('sorts by priority and title', async () => {
    const byPriority = await titles({}, { field: 'priority', direction: 'desc' });
    assert.equal(byPriority[0], 'Pay 100% of rent');
    assert.equal(byPriority[3], 'Buy milk');
    assert.deepEqual(await titles({}, { field: 'title', direction: 'asc' }), [
      'Buy milk',
      'Pay 100% of rent',
      'Plan trip',
      'Someday',
    ]);
  });

  it('filters by priority, category, label and due bucket', async () => {
    assert.deepEqual(await titles({ priorities: ['high'] }), ['Pay 100% of rent']);
    assert.deepEqual(await titles({ priorities: ['low', 'high'] }), [
      'Pay 100% of rent',
      'Buy milk',
    ]);
    const [home] = await taxonomy.categories();
    assert.ok(home);
    assert.deepEqual(await titles({ categoryId: home.id }), ['Buy milk']);
    assert.equal((await titles({ categoryId: NO_CATEGORY })).length, 3);
    const [errand] = await taxonomy.labels();
    assert.ok(errand);
    assert.deepEqual(await titles({ labelIds: [errand.id] }), ['Buy milk']);
    assert.deepEqual(await titles({ due: 'today' }), ['Buy milk']);
    assert.deepEqual(await titles({ due: 'overdue' }), ['Pay 100% of rent']);
    assert.deepEqual(await titles({ due: 'upcoming' }), ['Plan trip']);
    assert.deepEqual(await titles({ due: 'none' }), ['Someday']);
  });

  it('treats a timed task due earlier today as overdue but an all-day one as not', async () => {
    await create({ title: 'Earlier today', due: { at: at(2026, 10, 5, 9), hasTime: true } });
    await create({ title: 'All day today', due: { at: at(2026, 10, 5), hasTime: false } });
    const overdue = await titles({ due: 'overdue' });
    assert.ok(overdue.includes('Earlier today'));
    assert.ok(!overdue.includes('All day today'));
  });

  it('honours the result limit', async () => {
    const limited = await tasks.list({ ...DEFAULT_FILTER }, defaultSortFor('active'), 2);
    assert.equal(limited.length, 2);
  });

  it('computes today stats', async () => {
    const stats = await tasks.stats();
    assert.deepEqual(stats, { dueToday: 1, doneToday: 0, overdue: 1 });
  });
});

describe('completion, archive and delete lifecycle', () => {
  it('moves tasks between active and completed scopes', async () => {
    const id = await create({ title: 'Done soon' });
    await tasks.setCompleted(id, true);
    assert.deepEqual(await titles({ scope: 'active' }), []);
    assert.deepEqual(await titles({ scope: 'completed' }), ['Done soon']);
    await tasks.setCompleted(id, false);
    assert.deepEqual(await titles({ scope: 'active' }), ['Done soon']);
  });

  it('spawns the next occurrence of a repeating task atomically', async () => {
    const cat = await taxonomy.saveCategory({ id: null, name: 'Chores', color: '#000' });
    assert.ok(cat.ok);
    const id = await create({
      title: 'Water plants',
      categoryId: cat.id,
      due: { at: at(2026, 10, 5, 8), hasTime: true },
      reminderOffsetMinutes: 15,
      repeat: { unit: 'day', interval: 1, weekdays: 0 },
      subtasks: [{ id: null, title: 'Balcony', completed: true }],
    });
    await tasks.setCompleted(id, true);

    const active = await list();
    assert.equal(active.length, 1);
    const [next] = active;
    assert.ok(next);
    assert.notEqual(next.id, id);
    assert.equal(next.title, 'Water plants');
    assert.equal(next.category?.name, 'Chores');
    assert.equal(next.due?.at, at(2026, 10, 6, 8));
    assert.equal(next.reminderAt, at(2026, 10, 6, 7, 45));
    const detail = await tasks.get(next.id);
    assert.equal(detail?.subtasks[0]?.completed, false);
    assert.equal((await list({ scope: 'completed' })).length, 1);
  });

  it('does not spawn anything for non-repeating tasks or when reopening', async () => {
    const id = await create({ due: { at: at(2026, 10, 5, 8), hasTime: true } });
    await tasks.setCompleted(id, true);
    await tasks.setCompleted(id, false);
    assert.equal((await list()).length, 1);
  });

  it('archives and restores, hiding archived tasks from other scopes', async () => {
    const a = await create({ title: 'A' });
    const b = await create({ title: 'B' });
    await tasks.archive([a, b]);
    assert.deepEqual(await titles({ scope: 'active' }), []);
    assert.equal((await titles({ scope: 'archived' })).length, 2);
    await tasks.restore([a]);
    assert.deepEqual(await titles({ scope: 'active' }), ['A']);
  });

  it('soft-deletes, supports undo, and purges permanently', async () => {
    const a = await create({ title: 'A' });
    const b = await create({ title: 'B' });
    await tasks.remove([a, b]);
    assert.equal((await list()).length, 0);
    assert.equal(await tasks.get(a), null);
    await tasks.undoRemove([a]);
    assert.deepEqual(await titles(), ['A']);
    await tasks.purge([b]);
    await tasks.undoRemove([b]);
    assert.deepEqual(await titles(), ['A']); // b is gone for good
    await tasks.remove([a]);
    await tasks.purgeLeftovers();
    await tasks.undoRemove([a]);
    assert.equal((await list()).length, 0);
  });

  it('cascades subtask deletion when a task is purged', async () => {
    const id = await create({ subtasks: [{ id: null, title: 'S', completed: false }] });
    await tasks.remove([id]);
    await tasks.purge([id]);
    assert.equal(await tasks.get(id), null);
  });
});

describe('reminders', () => {
  const due = { at: at(2026, 10, 6, 10), hasTime: true };

  it('schedules a future reminder and stores the notification id', async () => {
    const id = await create({ due, reminderOffsetMinutes: 60 });
    assert.equal(scheduler.scheduled.size, 1);
    const [only] = [...scheduler.scheduled.values()];
    assert.equal(only?.fireAt, at(2026, 10, 6, 9));
    assert.equal(only?.taskId, id);
    assert.equal(only?.isAlarm, false);
    assert.ok((await tasks.get(id))?.notificationId);
  });

  it('uses alarm delivery for alarm tasks', async () => {
    await create({ due, reminderOffsetMinutes: 0, isAlarm: true });
    assert.equal([...scheduler.scheduled.values()][0]?.isAlarm, true);
  });

  it('reschedules on edit without leaking the old notification', async () => {
    const id = await create({ due, reminderOffsetMinutes: 60 });
    await tasks.save(draft({ due, reminderOffsetMinutes: 5 }), id);
    assert.equal(scheduler.scheduled.size, 1);
    assert.equal([...scheduler.scheduled.values()][0]?.fireAt, at(2026, 10, 6, 9, 55));
    assert.equal(scheduler.cancelled.length, 1);
  });

  it('cancels on complete, archive and delete, and restores on undo', async () => {
    const id = await create({ due, reminderOffsetMinutes: 0 });
    await tasks.setCompleted(id, true);
    assert.equal(scheduler.scheduled.size, 0);
    await tasks.setCompleted(id, false);
    assert.equal(scheduler.scheduled.size, 1);
    await tasks.archive([id]);
    assert.equal(scheduler.scheduled.size, 0);
    await tasks.restore([id]);
    assert.equal(scheduler.scheduled.size, 1);
    await tasks.remove([id]);
    assert.equal(scheduler.scheduled.size, 0);
    await tasks.undoRemove([id]);
    assert.equal(scheduler.scheduled.size, 1);
  });

  it('reports blocked and past reminders without scheduling', async () => {
    scheduler.blocked = true;
    const blocked = await tasks.save(draft({ due, reminderOffsetMinutes: 0 }), null);
    assert.ok(blocked.ok && blocked.reminder === 'blocked');
    scheduler.blocked = false;
    const past = await tasks.save(
      draft({ due: { at: at(2026, 10, 5, 11), hasTime: true }, reminderOffsetMinutes: 0 }),
      null,
    );
    assert.ok(past.ok && past.reminder === 'past');
    assert.equal(scheduler.scheduled.size, 0);
  });

  it('snoozes by rescheduling relative to now', async () => {
    const id = await create({ due, reminderOffsetMinutes: 0 });
    await tasks.snooze(id, 10);
    const [only] = [...scheduler.scheduled.values()];
    assert.equal(only?.fireAt, now + 10 * 60_000);
    assert.equal(scheduler.scheduled.size, 1);
  });

  it('schedules the next occurrence of a completed repeating task', async () => {
    const id = await create({
      due: { at: at(2026, 10, 5, 13), hasTime: true },
      reminderOffsetMinutes: 0,
      repeat: { unit: 'day', interval: 1, weekdays: 0 },
    });
    await tasks.setCompleted(id, true);
    assert.equal(scheduler.scheduled.size, 1);
    assert.equal([...scheduler.scheduled.values()][0]?.fireAt, at(2026, 10, 6, 13));
  });
});

describe('categories and labels', () => {
  it('rejects empty, long and duplicate names (case-insensitive)', async () => {
    assert.equal((await taxonomy.saveCategory({ id: null, name: ' ', color: '#000' })).ok, false);
    assert.equal(
      (await taxonomy.saveCategory({ id: null, name: 'x'.repeat(31), color: '#000' })).ok,
      false,
    );
    const first = await taxonomy.saveLabel({ id: null, name: 'Focus', color: '#000' });
    assert.ok(first.ok);
    assert.equal((await taxonomy.saveLabel({ id: null, name: 'focus', color: '#111' })).ok, false);
    assert.ok((await taxonomy.saveLabel({ id: first.id, name: 'FOCUS', color: '#111' })).ok);
  });

  it('detaches a deleted category and label from their tasks', async () => {
    const cat = await taxonomy.saveCategory({ id: null, name: 'Gone', color: '#000' });
    const label = await taxonomy.saveLabel({ id: null, name: 'Gone', color: '#000' });
    assert.ok(cat.ok && label.ok);
    const id = await create({ categoryId: cat.id, labelIds: [label.id] });
    await taxonomy.deleteCategory(cat.id);
    await taxonomy.deleteLabel(label.id);
    const task = await tasks.get(id);
    assert.equal(task?.category, null);
    assert.deepEqual(task?.labels, []);
  });
});
