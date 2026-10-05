import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeReminderAt } from '@/features/tasks/domain/reminder';
import { recurrencePresetOf, ruleForRecurrencePreset, weekdayBit } from '@/core';
import { nextDueAfter } from '@/features/tasks/domain/repeat';
import { emptyDraft, hasErrors, validateDraft } from '@/features/tasks/domain/validation';
import type { RepeatRule } from '@/features/tasks/domain/entities';

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const parts = (ts: number) => {
  const d = new Date(ts);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()];
};
const rule = (unit: RepeatRule['unit'], interval = 1, weekdays = 0): RepeatRule => ({
  unit,
  interval,
  weekdays,
});
const farPast = at(2000, 1, 1);

describe('repeat rules', () => {
  it('advances daily, keeping the time of day', () => {
    const next = nextDueAfter(rule('day'), { at: at(2026, 3, 7, 18, 30), hasTime: true }, farPast);
    assert.deepEqual(parts(next.at), [2026, 3, 8, 18, 30]);
  });

  it('clamps monthly repeats to the end of shorter months', () => {
    const jan31 = { at: at(2027, 1, 31, 9), hasTime: true };
    assert.deepEqual(
      parts(nextDueAfter(rule('month'), jan31, farPast).at).slice(0, 3),
      [2027, 2, 28],
    );
    const leap = { at: at(2028, 1, 31, 9), hasTime: true };
    assert.deepEqual(
      parts(nextDueAfter(rule('month'), leap, farPast).at).slice(0, 3),
      [2028, 2, 29],
    );
  });

  it('repeats weekly on the same weekday when no days are chosen', () => {
    const next = nextDueAfter(rule('week'), { at: at(2026, 10, 5, 8), hasTime: true }, farPast);
    assert.deepEqual(parts(next.at).slice(0, 3), [2026, 10, 12]);
  });

  it('honours selected weekdays (Mon + Wed)', () => {
    const mask = weekdayBit(1) | weekdayBit(3);
    const monday = { at: at(2026, 10, 5, 8), hasTime: true }; // Monday
    const wed = nextDueAfter(rule('week', 1, mask), monday, farPast);
    assert.deepEqual(parts(wed.at).slice(0, 3), [2026, 10, 7]);
    const nextMon = nextDueAfter(rule('week', 1, mask), wed, farPast);
    assert.deepEqual(parts(nextMon.at).slice(0, 3), [2026, 10, 12]);
  });

  it('supports every-N-weeks with selected weekdays', () => {
    const mask = weekdayBit(1) | weekdayBit(3);
    const wed = { at: at(2026, 10, 7, 8), hasTime: true };
    const next = nextDueAfter(rule('week', 2, mask), wed, farPast);
    assert.deepEqual(parts(next.at).slice(0, 3), [2026, 10, 19]); // Monday two weeks later
  });

  it('never returns an occurrence in the past when completed late', () => {
    const now = at(2026, 10, 20, 12);
    const next = nextDueAfter(rule('day'), { at: at(2026, 10, 1, 9), hasTime: true }, now);
    assert.ok(next.at > now);
    assert.deepEqual(parts(next.at), [2026, 10, 21, 9, 0]);
  });

  it('keeps today for an overdue all-day task', () => {
    const now = at(2026, 10, 20, 12);
    const next = nextDueAfter(rule('day'), { at: at(2026, 10, 19), hasTime: false }, now);
    assert.deepEqual(parts(next.at).slice(0, 3), [2026, 10, 20]);
    assert.equal(next.hasTime, false);
  });

  it('survives daylight-saving transitions without drifting the clock time', () => {
    const next = nextDueAfter(rule('day'), { at: at(2026, 3, 7, 9), hasTime: true }, farPast);
    assert.equal(new Date(next.at).getHours(), 9);
    const across = nextDueAfter(rule('week'), { at: at(2026, 3, 1, 9), hasTime: true }, farPast);
    assert.equal(new Date(across.at).getHours(), 9);
  });

  it('maps rules to presets and back', () => {
    assert.equal(recurrencePresetOf(null), 'none');
    assert.equal(recurrencePresetOf(rule('day')), 'daily');
    assert.equal(recurrencePresetOf(rule('week')), 'weekly');
    assert.equal(recurrencePresetOf(rule('month')), 'monthly');
    assert.equal(recurrencePresetOf(rule('week', 1, weekdayBit(2))), 'custom');
    assert.equal(recurrencePresetOf(rule('day', 3)), 'custom');
    assert.deepEqual(ruleForRecurrencePreset('daily', null), rule('day'));
    assert.equal(ruleForRecurrencePreset('none', rule('day')), null);
  });
});

describe('reminders', () => {
  it('computes timed reminders relative to the due time', () => {
    const due = { at: at(2026, 10, 5, 17, 0), hasTime: true };
    assert.deepEqual(parts(computeReminderAt(due, 30)), [2026, 10, 5, 16, 30]);
    assert.deepEqual(parts(computeReminderAt(due, 1440)), [2026, 10, 4, 17, 0]);
  });

  it('notifies all-day tasks at 9:00', () => {
    const due = { at: at(2026, 10, 5), hasTime: false };
    assert.deepEqual(parts(computeReminderAt(due, 0)), [2026, 10, 5, 9, 0]);
    assert.deepEqual(parts(computeReminderAt(due, 1440)), [2026, 10, 4, 9, 0]);
  });
});

describe('draft validation', () => {
  it('requires a title', () => {
    assert.ok(validateDraft({ ...emptyDraft(), title: '   ' }).title);
    assert.equal(hasErrors(validateDraft({ ...emptyDraft(), title: 'Pay rent' })), false);
  });

  it('rejects reminders and repeats without a due date', () => {
    const base = { ...emptyDraft(), title: 'x' };
    assert.ok(validateDraft({ ...base, reminderOffsetMinutes: 0 }).reminder);
    assert.ok(validateDraft({ ...base, repeat: rule('day') }).repeat);
  });

  it('rejects reminder offsets that do not fit the due kind', () => {
    const base = { ...emptyDraft(), title: 'x', due: { at: at(2026, 1, 1), hasTime: false } };
    assert.ok(validateDraft({ ...base, reminderOffsetMinutes: 15 }).reminder);
    assert.equal(validateDraft({ ...base, reminderOffsetMinutes: 0 }).reminder, undefined);
  });

  it('bounds repeat intervals', () => {
    const base = { ...emptyDraft(), title: 'x', due: { at: at(2026, 1, 1), hasTime: true } };
    assert.ok(validateDraft({ ...base, repeat: rule('day', 0) }).repeat);
    assert.ok(validateDraft({ ...base, repeat: rule('day', 366) }).repeat);
    assert.equal(validateDraft({ ...base, repeat: rule('day', 365) }).repeat, undefined);
  });
});
