import { addDays, hasWeekday, startOfDay } from '@/core';
import type { DueDate, RepeatRule } from './entities';

export type RepeatPreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export const REPEAT_PRESETS: readonly RepeatPreset[] = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'custom',
];

export const MAX_REPEAT_INTERVAL = 365;
const SAFETY_LIMIT = 2_000;

export function presetOf(rule: RepeatRule | null): RepeatPreset {
  if (rule === null) {
    return 'none';
  }
  if (rule.interval === 1 && rule.weekdays === 0) {
    if (rule.unit === 'day') {
      return 'daily';
    }
    if (rule.unit === 'week') {
      return 'weekly';
    }
    return 'monthly';
  }
  return 'custom';
}

export function ruleForPreset(preset: RepeatPreset, current: RepeatRule | null): RepeatRule | null {
  switch (preset) {
    case 'none':
      return null;
    case 'daily':
      return { unit: 'day', interval: 1, weekdays: 0 };
    case 'weekly':
      return { unit: 'week', interval: 1, weekdays: 0 };
    case 'monthly':
      return { unit: 'month', interval: 1, weekdays: 0 };
    default:
      return current !== null && presetOf(current) === 'custom'
        ? current
        : { unit: 'day', interval: 2, weekdays: 0 };
  }
}

/** Days since the Unix epoch for a local calendar day; immune to DST shifts. */
function dayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function shiftMonths(at: number, months: number): number {
  const date = new Date(at);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.getTime();
}

function nextWeekday(at: number, rule: RepeatRule): number {
  const origin = new Date(at);
  const originIndex = dayIndex(origin);
  const weekStart = originIndex - origin.getDay();

  for (let step = 1; step <= 7 * rule.interval + 7; step += 1) {
    const candidate = new Date(addDays(at, step));
    const weeksElapsed = Math.floor((originIndex + step - weekStart) / 7);
    if (hasWeekday(rule.weekdays, candidate.getDay()) && weeksElapsed % rule.interval === 0) {
      return candidate.getTime();
    }
  }
  return addDays(at, 7 * rule.interval);
}

/** The occurrence immediately following `at`, keeping the time of day. */
function nextOccurrenceAt(rule: RepeatRule, at: number): number {
  switch (rule.unit) {
    case 'day':
      return addDays(at, rule.interval);
    case 'month':
      return shiftMonths(at, rule.interval);
    default:
      return rule.weekdays === 0 ? addDays(at, 7 * rule.interval) : nextWeekday(at, rule);
  }
}

/**
 * Next due date after completing a recurring task. It skips occurrences that are already in the
 * past so completing a task late never produces an immediately overdue copy.
 */
export function nextDueAfter(rule: RepeatRule, due: DueDate, now: number): DueDate {
  const earliest = due.hasTime ? now : startOfDay(now);
  let at = nextOccurrenceAt(rule, due.at);

  for (let guard = 0; guard < SAFETY_LIMIT && at < earliest; guard += 1) {
    at = nextOccurrenceAt(rule, at);
  }
  return { at, hasTime: due.hasTime };
}
