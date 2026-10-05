import { addDaysToKey, daysBetweenKeys, weekdayOfKey, type DateKey } from '@/core';

import type { Habit, HabitHistory, HabitLog, HabitPeriod } from './entities';
import { nextUnit, previousUnit, unitKeyOf, unitRange, type UnitKey } from './periods';
import { isScheduledOn } from './schedule';

/**
 * - satisfied: the goal for the period was met.
 * - missed: the period ended without meeting the goal.
 * - excused: not met, but skipped or paused, so it neither extends nor breaks a streak.
 * - pending: the period is still open and the goal is not met yet.
 * - off: a day the habit is not scheduled on.
 */
export type UnitState = 'satisfied' | 'missed' | 'excused' | 'pending' | 'off';

export interface UnitProgress {
  unit: UnitKey;
  start: DateKey;
  end: DateKey;
  done: number;
  goal: number;
  state: UnitState;
}

export type HabitRules = Pick<Habit, 'period' | 'goalCount' | 'weekdays' | 'startDate'>;

/** Hard stop for loops over history, far beyond any real habit's lifetime. */
const MAX_UNITS = 20_000;

type HeatmapStatus = 'done' | 'partial' | 'skipped' | 'paused' | 'off' | 'none' | 'blank';

export interface HeatmapDay {
  date: DateKey;
  status: HeatmapStatus;
  count: number;
  /** 0 to 4: how much of the daily goal was reached. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  totalCompletions: number;
  /** Days with at least one completion. */
  activeDays: number;
  /** Share of closed periods in the recent window that met the goal, or null when none closed yet. */
  successRate: number | null;
  /** The latest periods (7 days, 8 weeks or 6 months) oldest first. */
  recent: UnitProgress[];
  /** Completions by weekday, Sunday = index 0. */
  weekdayCounts: number[];
}

const RECENT_UNITS: Record<HabitPeriod, number> = { daily: 7, weekly: 8, monthly: 6 };
const RATE_WINDOW_UNITS: Record<HabitPeriod, number> = { daily: 30, weekly: 12, monthly: 12 };

function levelFor(count: number, goal: number): HeatmapDay['level'] {
  if (count <= 0) {
    return 0;
  }
  return Math.min(4, Math.max(1, Math.ceil((count / goal) * 4))) as HeatmapDay['level'];
}

/** Evaluates one habit's history as of `today`. Create once per habit, then query it. */
export function createEvaluator(rules: HabitRules, history: HabitHistory, today: DateKey) {
  const { period, goalCount } = rules;
  const logsByDate = new Map<DateKey, HabitLog>();
  const totals = new Map<UnitKey, { done: number; skipped: boolean }>();

  for (const log of history.logs) {
    logsByDate.set(log.date, log);
    const unit = unitKeyOf(log.date, period);
    const entry = totals.get(unit) ?? { done: 0, skipped: false };
    if (log.status === 'done') {
      entry.done += log.count;
    } else {
      entry.skipped = true;
    }
    totals.set(unit, entry);
  }

  const isPaused = (start: DateKey, end: DateKey) =>
    history.pauses.some((pause) => pause.start <= end && (pause.end === null || pause.end > start));

  function progressOf(unit: UnitKey): UnitProgress {
    const { start, end } = unitRange(unit, period);
    const entry = totals.get(unit);
    const done = entry?.done ?? 0;
    let state: UnitState;

    if (period === 'daily' && !isScheduledOn(rules, unit)) {
      state = 'off';
    } else if (done >= goalCount) {
      state = 'satisfied';
    } else if (entry?.skipped || isPaused(start, end)) {
      state = 'excused';
    } else if (end >= today) {
      state = 'pending';
    } else {
      // A habit that began mid-period is not penalised for the part before it started.
      state = start < rules.startDate ? 'excused' : 'missed';
    }
    return { unit, start, end, done, goal: goalCount, state };
  }

  // Days logged before the start date (a backfill) move the effective start back to include them.
  const earliestLog = history.logs.reduce<DateKey | null>(
    (earliest, log) => (earliest === null || log.date < earliest ? log.date : earliest),
    null,
  );
  const startDate =
    earliestLog !== null && earliestLog < rules.startDate ? earliestLog : rules.startDate;

  const currentUnit = unitKeyOf(today, period);
  const firstUnit = unitKeyOf(startDate, period);

  function streaks(): { current: number; best: number } {
    let run = 0;
    let best = 0;
    let unit = firstUnit;
    for (let step = 0; unit <= currentUnit && step < MAX_UNITS; step += 1) {
      const { state } = progressOf(unit);
      if (state === 'satisfied') {
        run += 1;
        best = Math.max(best, run);
      } else if (state === 'missed') {
        run = 0;
      }
      unit = nextUnit(unit, period);
    }
    return { current: run, best };
  }

  function recentUnits(limit: number): UnitProgress[] {
    const units: UnitProgress[] = [];
    let unit = currentUnit;
    for (let i = 0; i < limit && unit >= firstUnit; i += 1) {
      units.unshift(progressOf(unit));
      unit = previousUnit(unit, period);
    }
    return units;
  }

  return {
    progressOf,
    streaks,

    current(): UnitProgress {
      return progressOf(currentUnit);
    },

    /** What was logged on one day, for the quick-complete controls. */
    dayLog(day: DateKey): { count: number; skipped: boolean } {
      const log = logsByDate.get(day);
      return {
        count: log?.status === 'done' ? log.count : 0,
        skipped: log?.status === 'skipped',
      };
    },

    heatmap(from: DateKey, to: DateKey): HeatmapDay[] {
      const days: HeatmapDay[] = [];
      const dailyGoal = period === 'daily' ? goalCount : 1;
      const length = daysBetweenKeys(from, to) + 1;

      for (let i = 0; i < length; i += 1) {
        const date = addDaysToKey(from, i);
        const log = logsByDate.get(date);
        const count = log?.status === 'done' ? log.count : 0;
        let status: HeatmapStatus;

        if (date > today || date < startDate) {
          status = 'blank';
        } else if (count > 0) {
          status = count >= dailyGoal ? 'done' : 'partial';
        } else if (log?.status === 'skipped') {
          status = 'skipped';
        } else if (isPaused(date, date)) {
          status = 'paused';
        } else if (!isScheduledOn(rules, date)) {
          status = 'off';
        } else {
          status = 'none';
        }
        days.push({ date, status, count, level: levelFor(count, dailyGoal) });
      }
      return days;
    },

    stats(): HabitStats {
      const { current, best } = streaks();
      const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
      let totalCompletions = 0;
      let activeDays = 0;
      for (const log of history.logs) {
        if (log.status === 'done') {
          totalCompletions += log.count;
          activeDays += 1;
          const weekday = weekdayOfKey(log.date);
          weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + log.count;
        }
      }

      const window = recentUnits(RATE_WINDOW_UNITS[period]);
      const satisfied = window.filter((unit) => unit.state === 'satisfied').length;
      const missed = window.filter((unit) => unit.state === 'missed').length;

      return {
        currentStreak: current,
        bestStreak: best,
        totalCompletions,
        activeDays,
        successRate: satisfied + missed === 0 ? null : satisfied / (satisfied + missed),
        recent: recentUnits(RECENT_UNITS[period]),
        weekdayCounts,
      };
    },
  };
}

export type HabitEvaluator = ReturnType<typeof createEvaluator>;

/** Everything a habit row or card needs, computed once per habit per refresh. */
export interface HabitSummary {
  habit: Habit;
  current: UnitProgress;
  streak: number;
  /** Completions logged today. */
  todayCount: number;
  skippedToday: boolean;
  scheduledToday: boolean;
}

export function summarize(habit: Habit, history: HabitHistory, today: DateKey): HabitSummary {
  const evaluator = createEvaluator(habit, history, today);
  const day = evaluator.dayLog(today);
  return {
    habit,
    current: evaluator.current(),
    streak: evaluator.streaks().current,
    todayCount: day.count,
    skippedToday: day.skipped,
    scheduledToday: isScheduledOn(habit, today),
  };
}

/** Fraction (0 to 1) of the current period's goal that is complete. */
export function progressFraction(summary: HabitSummary): number {
  return summary.current.goal === 0 ? 0 : Math.min(1, summary.current.done / summary.current.goal);
}
