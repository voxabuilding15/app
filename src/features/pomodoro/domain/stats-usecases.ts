import {
  addDaysToKey,
  dateKeyToNoon,
  firstDayOfMonthKey,
  startOfDay,
  startOfWeekKey,
  toDateKey,
  lastDayOfMonthKey,
  type Clock,
  type DateKey,
} from '@/core';

import type { LinkTotal } from './entities';
import type { SessionRepository } from './ports';
import type { PomodoroSettings } from './settings';
import {
  buckets,
  goalFraction,
  heatLevel,
  streaks,
  sumDays,
  totalsByDay,
  type Streaks,
  type StatsPeriod,
  type Totals,
} from './stats';

/** How far back statistics look: enough for a year of months and any streak worth showing. */
const HISTORY_DAYS = 400;
const HEATMAP_DAYS = 182;
const SERIES_COUNT: Record<StatsPeriod, number> = { day: 14, week: 12, month: 12 };
const LINK_DAYS = 30;
const LINK_LIMIT = 5;

export interface GoalProgress extends Totals {
  goalMinutes: number;
  /** 1 means reached; null when the goal is off. */
  fraction: number | null;
}

interface SeriesPoint extends Totals {
  from: DateKey;
  to: DateKey;
}

export interface HeatDay {
  date: DateKey;
  focusSeconds: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface PomodoroOverview {
  today: GoalProgress;
  week: GoalProgress;
  month: GoalProgress;
  streak: Streaks;
  /** Deep focus over the last 30 days. */
  deepFocus: number | null;
  series: Record<StatsPeriod, SeriesPoint[]>;
  /** The last `HEATMAP_DAYS` days, oldest first. */
  heatmap: HeatDay[];
  links: LinkTotal[];
}

interface StatsUseCaseDeps {
  sessions: SessionRepository;
  clock: Clock;
}

function startOf(key: DateKey): number {
  return startOfDay(dateKeyToNoon(key));
}

export function createStatsUseCases({ sessions, clock }: StatsUseCaseDeps) {
  return {
    async overview(settings: PomodoroSettings): Promise<PomodoroOverview> {
      const today = toDateKey(clock.now());
      const [rows, links] = await Promise.all([
        sessions.listFocus(
          startOf(addDaysToKey(today, -HISTORY_DAYS)),
          startOf(addDaysToKey(today, 1)),
        ),
        sessions.linkTotals(
          startOf(addDaysToKey(today, 1 - LINK_DAYS)),
          startOf(addDaysToKey(today, 1)),
          LINK_LIMIT,
        ),
      ]);
      const days = totalsByDay(rows);

      const progress = (from: DateKey, to: DateKey, goalMinutes: number): GoalProgress => {
        const totals = sumDays(days, from, to);
        return {
          ...totals,
          goalMinutes,
          fraction: goalFraction(totals.focusSeconds, goalMinutes),
        };
      };

      const weekStart = startOfWeekKey(today);
      const monthStart = firstDayOfMonthKey(today);

      const completedDays = new Set<DateKey>();
      for (const [day, totals] of days) {
        if (totals.completed > 0) {
          completedDays.add(day);
        }
      }

      const series = {} as Record<StatsPeriod, SeriesPoint[]>;
      for (const period of ['day', 'week', 'month'] as const) {
        series[period] = buckets(period, today, SERIES_COUNT[period]).map((bucket) => ({
          ...bucket,
          ...sumDays(days, bucket.from, bucket.to),
        }));
      }

      const heatmap: HeatDay[] = Array.from({ length: HEATMAP_DAYS }, (_, index) => {
        const date = addDaysToKey(today, index - (HEATMAP_DAYS - 1));
        const focusSeconds = days.get(date)?.focusSeconds ?? 0;
        return { date, focusSeconds, level: heatLevel(focusSeconds, settings.dailyGoalMinutes) };
      });

      return {
        today: progress(today, today, settings.dailyGoalMinutes),
        week: progress(weekStart, addDaysToKey(weekStart, 6), settings.weeklyGoalMinutes),
        month: progress(monthStart, lastDayOfMonthKey(monthStart), settings.monthlyGoalMinutes),
        streak: streaks(completedDays, today),
        deepFocus: sumDays(days, addDaysToKey(today, 1 - LINK_DAYS), today).deepFocus,
        series,
        heatmap,
        links,
      };
    },
  };
}

export type StatsUseCases = ReturnType<typeof createStatsUseCases>;
