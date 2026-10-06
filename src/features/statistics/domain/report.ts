import { addDaysToKey, daysBetweenKeys, toDateKey, weekdayOfKey, type DateKey } from '@/core';

import { expandEvent } from '../../calendar/domain/occurrences';
import type { EventEntry } from '../../calendar/domain/entities';
import type { HabitEntry } from '../../habits/domain/entities';
import { nextUnit, unitKeyOf, unitRange } from '../../habits/domain/periods';
import { createEvaluator } from '../../habits/domain/progress';
import type { FocusRow } from '../../pomodoro/domain/entities';
import { sumDays, totalsByDay } from '../../pomodoro/domain/stats';

import {
  bucketsFor,
  dayCount,
  toSpan,
  type Bucket,
  type DayRange,
  type StatsPeriod,
  type TimeSpan,
} from './range';
import type { DueTask } from './ports';

/** Everything read from the app for one report, covering the period and the one before it. */
export interface Facts {
  now: number;
  today: DateKey;
  tasksCompleted: readonly number[];
  tasksCreated: readonly number[];
  tasksDue: readonly DueTask[];
  habits: readonly HabitEntry[];
  events: readonly EventEntry[];
  focus: readonly FocusRow[];
  notesCreated: readonly number[];
  notesUpdated: readonly number[];
}

interface TaskFigures {
  completed: number;
  created: number;
  due: number;
  /** Tasks due in the period that are done. */
  dueCompleted: number;
  /** Tasks due in the period, already past due and still open. */
  overdue: number;
  /** Done share of the tasks whose due date has passed; null when there are none. */
  rate: number | null;
}

interface HabitFigures {
  /** Check-ins logged in the period. */
  completions: number;
  /** Share of finished periods where the goal was met; null when there is nothing to judge yet. */
  consistency: number | null;
  met: number;
  missed: number;
}

interface FocusFigures {
  seconds: number;
  sessions: number;
  completedSessions: number;
  /** Average deep focus score (0 to 100) weighted by session length. */
  deepFocus: number | null;
}

interface CalendarFigures {
  events: number;
  hours: number;
  daysWithEvents: number;
  /** Share of the days so far that had something scheduled. */
  usage: number;
  /** Weekday (Sunday = 0) with the most events, or null without events. */
  busiestWeekday: number | null;
}

interface NoteFigures {
  created: number;
  updated: number;
}

export interface Scores {
  /** 0 to 100 blend of tasks, habits and focus; null with nothing to measure. */
  productivity: number | null;
  focus: number | null;
  habits: number | null;
  tasks: number | null;
}

export interface Slice {
  tasks: TaskFigures;
  habits: HabitFigures;
  focus: FocusFigures;
  calendar: CalendarFigures;
  notes: NoteFigures;
  scores: Scores;
}

export type Metric = 'focus' | 'tasks' | 'habits' | 'events' | 'notes';

export interface SeriesPoint {
  bucket: Bucket;
  value: number;
}

const WEIGHTS = { tasks: 0.35, habits: 0.35, focus: 0.3 } as const;

const inSpan = (value: number, span: TimeSpan) => value >= span.from && value < span.to;
const countIn = (values: readonly number[], span: TimeSpan) =>
  values.reduce((total, value) => total + (inSpan(value, span) ? 1 : 0), 0);

function percent(rate: number | null): number | null {
  return rate === null ? null : Math.round(rate * 100);
}

function taskFigures(facts: Facts, span: TimeSpan): TaskFigures {
  const due = facts.tasksDue.filter((task) => inSpan(task.dueAt, span));
  const dueCompleted = due.filter((task) => task.completed).length;
  const overdue = due.filter((task) => !task.completed && task.dueAt < facts.now).length;
  return {
    completed: countIn(facts.tasksCompleted, span),
    created: countIn(facts.tasksCreated, span),
    due: due.length,
    dueCompleted,
    overdue,
    rate: dueCompleted + overdue === 0 ? null : dueCompleted / (dueCompleted + overdue),
  };
}

/** Check-ins in the range, and how consistently the goals of finished periods were met. */
function habitFigures(facts: Facts, range: DayRange): HabitFigures {
  let completions = 0;
  let met = 0;
  let missed = 0;
  let pending = 0;
  let finished = 0;

  for (const entry of facts.habits) {
    for (const log of entry.logs) {
      if (log.status === 'done' && log.date >= range.from && log.date <= range.to) {
        completions += log.count;
      }
    }
    const { habit } = entry;
    const evaluator = createEvaluator(habit, entry, facts.today);
    const last = unitKeyOf(range.to, habit.period);
    for (
      let unit = unitKeyOf(range.from, habit.period), guard = 0;
      unit <= last && guard < 4_000;
      unit = nextUnit(unit, habit.period), guard += 1
    ) {
      const { start, end } = unitRange(unit, habit.period);
      if (end < range.from || end > range.to) {
        continue;
      }
      const { state } = evaluator.progressOf(unit);
      if ((state === 'satisfied' || state === 'missed') && end < facts.today) {
        finished += 1;
      }
      if (state === 'satisfied') {
        met += 1;
      } else if (state === 'missed') {
        missed += 1;
      } else if (state === 'pending' && start <= facts.today) {
        // A period that has not begun yet says nothing about consistency.
        pending += 1;
      }
    }
  }

  // Once a period has really ended, open ones are left out; before that, the open ones are all
  // there is, so what is still to do counts against the score so far.
  const consistency =
    finished > 0
      ? met / (met + missed)
      : met + missed + pending > 0
        ? met / (met + missed + pending)
        : null;
  return { completions, consistency, met, missed };
}

function focusFigures(facts: Facts, range: DayRange): FocusFigures {
  const totals = sumDays(totalsByDay(facts.focus), range.from, range.to);
  const span = toSpan(range);
  const rows = facts.focus.filter((row) => inSpan(row.startedAt, span));
  return {
    seconds: totals.focusSeconds,
    sessions: rows.length,
    completedSessions: totals.completed,
    deepFocus: totals.deepFocus,
  };
}

function calendarFigures(facts: Facts, range: DayRange): CalendarFigures {
  const span = toSpan(range);
  const days = new Set<DateKey>();
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  let events = 0;
  let milliseconds = 0;

  for (const entry of facts.events) {
    for (const occurrence of expandEvent(entry, span.from, span.to)) {
      events += 1;
      const start = Math.max(occurrence.start, span.from);
      const end = Math.min(occurrence.end, span.to);
      if (!entry.event.allDay) {
        milliseconds += Math.max(0, end - start);
      }
      const first = toDateKey(start);
      const last = toDateKey(Math.max(start, end - 1));
      for (let day = first, guard = 0; day <= last && guard < 400; day = addDaysToKey(day, 1)) {
        days.add(day);
        guard += 1;
      }
      const weekday = weekdayOfKey(toDateKey(occurrence.start));
      weekdays[weekday] = (weekdays[weekday] ?? 0) + 1;
    }
  }

  const elapsed = Math.max(
    1,
    daysBetweenKeys(range.from, range.to < facts.today ? range.to : facts.today) + 1,
  );
  const peak = Math.max(...weekdays);
  return {
    events,
    hours: milliseconds / 3_600_000,
    daysWithEvents: days.size,
    usage: Math.min(1, days.size / Math.min(elapsed, dayCount(range))),
    busiestWeekday: peak === 0 ? null : weekdays.indexOf(peak),
  };
}

/** Blends the scores that have data, weighting tasks and habits a little above focus. */
export function productivityScore(scores: Omit<Scores, 'productivity'>): number | null {
  const parts = [
    [scores.tasks, WEIGHTS.tasks],
    [scores.habits, WEIGHTS.habits],
    [scores.focus, WEIGHTS.focus],
  ] as const;
  let total = 0;
  let weight = 0;
  for (const [score, share] of parts) {
    if (score !== null) {
      total += score * share;
      weight += share;
    }
  }
  return weight === 0 ? null : Math.round(total / weight);
}

/** All the app-wide figures for one range of days. */
export function computeSlice(facts: Facts, range: DayRange): Slice {
  const span = toSpan(range);
  const tasks = taskFigures(facts, span);
  const habits = habitFigures(facts, range);
  const focus = focusFigures(facts, range);
  const base = {
    tasks: percent(tasks.rate),
    habits: percent(habits.consistency),
    focus: focus.deepFocus,
  };
  return {
    tasks,
    habits,
    focus,
    calendar: calendarFigures(facts, range),
    notes: {
      created: countIn(facts.notesCreated, span),
      updated: countIn(facts.notesUpdated, span),
    },
    scores: { ...base, productivity: productivityScore(base) },
  };
}

/** Metrics a period's chart can show: habits are logged per day, so not per hour. */
export function metricsFor(period: StatsPeriod): Metric[] {
  return period === 'day'
    ? ['focus', 'tasks', 'events', 'notes']
    : ['focus', 'tasks', 'habits', 'events', 'notes'];
}

/** One value per bucket (hour, day or month) of the period for a metric. */
export function seriesFor(
  metric: Metric,
  period: StatsPeriod,
  anchor: DateKey,
  facts: Facts,
): SeriesPoint[] {
  const buckets = bucketsFor(period, anchor);
  const checkIns = new Map<DateKey, number>();
  if (metric === 'habits') {
    for (const entry of facts.habits) {
      for (const log of entry.logs) {
        if (log.status === 'done') {
          checkIns.set(log.date, (checkIns.get(log.date) ?? 0) + log.count);
        }
      }
    }
  }
  // Expanded once for the whole period: repeating events are costly to expand bucket by bucket.
  const occurrenceStarts: number[] = [];
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (metric === 'events' && first !== undefined && last !== undefined) {
    for (const entry of facts.events) {
      for (const occurrence of expandEvent(entry, first.span.from, last.span.to)) {
        occurrenceStarts.push(occurrence.start);
      }
    }
  }
  return buckets.map((bucket): SeriesPoint => {
    switch (metric) {
      case 'focus':
        return {
          bucket,
          value: Math.round(
            facts.focus
              .filter((row) => inSpan(row.startedAt, bucket.span))
              .reduce((total, row) => total + row.durationSeconds, 0) / 60,
          ),
        };
      case 'tasks':
        return { bucket, value: countIn(facts.tasksCompleted, bucket.span) };
      case 'habits': {
        let total = 0;
        for (let day = bucket.days.from; day <= bucket.days.to; day = addDaysToKey(day, 1)) {
          total += checkIns.get(day) ?? 0;
        }
        return { bucket, value: total };
      }
      case 'events':
        return { bucket, value: countIn(occurrenceStarts, bucket.span) };
      default:
        return { bucket, value: countIn(facts.notesCreated, bucket.span) };
    }
  });
}
