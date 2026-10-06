import type { HeatmapCell } from '@/components';
import { monthOfKey, weekdayOfKey } from '@/core';

import type { HeatDay } from '../domain/stats-usecases';

import { formatDayLabel, formatFocusTime, shortMonth } from './format';

export interface HeatmapModel {
  columns: (HeatmapCell | null)[][];
  /** Month name above the first week of each month. */
  columnLabels: (string | null)[];
}

const DAYS_PER_WEEK = 7;

/** Monday-first weekday initials; only some rows are labelled to save space. */
export const HEATMAP_ROW_LABELS = ['M', '', 'W', '', 'F', '', ''] as const;

/**
 * Lays the most recent days out in calendar weeks (Monday to Sunday), showing at most `weeks`
 * columns and leaving the cells before the first day and after the last one blank.
 */
export function buildHeatmapModel(days: readonly HeatDay[], weeks: number): HeatmapModel {
  const columns: (HeatmapCell | null)[][] = [];
  let column: (HeatmapCell | null)[] = [];
  let labelled = '';
  const labels: (string | null)[] = [];

  days.forEach((day, index) => {
    const row = (weekdayOfKey(day.date) + 6) % DAYS_PER_WEEK;
    if (index === 0) {
      column = Array.from({ length: row }, () => null);
    }
    column.push({
      key: day.date,
      level: day.level,
      label: `${formatDayLabel(day.date)}: ${
        day.focusSeconds > 0 ? formatFocusTime(day.focusSeconds) : 'no focus'
      }`,
    });
    if (column.length === DAYS_PER_WEEK || index === days.length - 1) {
      while (column.length < DAYS_PER_WEEK) {
        column.push(null);
      }
      const first = column.find((cell) => cell !== null);
      const month = first === undefined || first === null ? '' : monthOfKey(first.key);
      labels.push(
        first !== undefined && first !== null && month !== labelled ? shortMonth(first.key) : null,
      );
      labelled = month === '' ? labelled : month;
      columns.push(column);
      column = [];
    }
  });

  return { columns: columns.slice(-weeks), columnLabels: labels.slice(-weeks) };
}
