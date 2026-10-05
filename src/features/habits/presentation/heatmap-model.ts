import { addDaysToKey, monthOfKey, startOfWeekKey, type DateKey } from '@/core';
import type { HeatmapCell } from '@/components';

import type { Habit } from '../domain/entities';
import type { HabitEvaluator, HeatmapDay } from '../domain/progress';

import { formatDay, shortMonth } from './format';

const DAYS_PER_WEEK = 7;

function describeDay(day: HeatmapDay, habit: Pick<Habit, 'period' | 'goalCount'>): string {
  const when = formatDay(day.date);
  switch (day.status) {
    case 'done':
    case 'partial':
      return habit.period === 'daily'
        ? `${when}: ${day.count} of ${habit.goalCount}`
        : `${when}: ${day.count} logged`;
    case 'skipped':
      return `${when}: skipped`;
    case 'paused':
      return `${when}: paused`;
    case 'off':
      return `${when}: not scheduled`;
    default:
      return `${when}: nothing logged`;
  }
}

export interface HeatmapModel {
  columns: (HeatmapCell | null)[][];
  /** Month name above the first week of each month. */
  columnLabels: (string | null)[];
}

/** Lays out the last `weeks` calendar weeks (Monday to Sunday) ending with the current week. */
export function buildHeatmapModel(
  evaluator: HabitEvaluator,
  habit: Pick<Habit, 'period' | 'goalCount'>,
  today: DateKey,
  weeks: number,
): HeatmapModel {
  const lastWeekStart = startOfWeekKey(today);
  const firstWeekStart = addDaysToKey(lastWeekStart, -(weeks - 1) * DAYS_PER_WEEK);
  const days = evaluator.heatmap(firstWeekStart, addDaysToKey(lastWeekStart, DAYS_PER_WEEK - 1));

  const columns: (HeatmapCell | null)[][] = [];
  const columnLabels: (string | null)[] = [];
  let previousMonth = '';

  for (let week = 0; week < weeks; week += 1) {
    const slice = days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK);
    columns.push(
      slice.map((day): HeatmapCell | null => {
        if (day.status === 'blank') {
          return null;
        }
        return {
          key: day.date,
          level: day.level,
          variant:
            day.status === 'skipped' || day.status === 'paused' || day.status === 'off'
              ? day.status
              : 'default',
          label: describeDay(day, habit),
        };
      }),
    );

    const first = slice[0];
    const month = first ? monthOfKey(first.date) : '';
    columnLabels.push(first && month !== previousMonth ? shortMonth(first.date) : null);
    previousMonth = month || previousMonth;
  }
  return { columns, columnLabels };
}

/** Monday-first weekday initials for the heatmap rows; only some rows are labelled to save space. */
export const HEATMAP_ROW_LABELS = ['M', '', 'W', '', 'F', '', ''] as const;
