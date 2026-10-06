import type { DateKey } from '@/core';

import { dayBounds, type CalendarItem } from './items';

export const MINUTES_PER_DAY = 24 * 60;
/** Timed items shorter than this are drawn this tall so they stay readable and tappable. */
const MIN_DISPLAY_MINUTES = 30;
export const SNAP_MINUTES = 15;

export interface TimelineBlock {
  item: CalendarItem;
  /** Minutes after midnight where the block starts (clipped to the day). */
  startMinutes: number;
  /** Minutes after midnight where the block ends, at least `MIN_DISPLAY_MINUTES` after the start. */
  endMinutes: number;
  /** Zero-based lane among overlapping blocks. */
  column: number;
  /** Number of lanes in this block's overlap group, so width = 1 / columns. */
  columns: number;
}

function clockMinutes(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Lays timed items out for one day: clips them to the day, gives them a minimum height, and
 * places overlapping ones side by side in lanes.
 */
export function layoutTimeline(items: readonly CalendarItem[], day: DateKey): TimelineBlock[] {
  const { start: dayStart, end: dayEnd } = dayBounds(day);

  const spans = items
    .filter((item) => !item.allDay)
    .map((item) => {
      const startMinutes = item.start <= dayStart ? 0 : clockMinutes(item.start);
      const rawEnd = item.end >= dayEnd ? MINUTES_PER_DAY : clockMinutes(item.end);
      const endMinutes = Math.min(
        MINUTES_PER_DAY,
        Math.max(rawEnd, startMinutes + MIN_DISPLAY_MINUTES),
      );
      return {
        item,
        startMinutes: Math.min(startMinutes, MINUTES_PER_DAY - MIN_DISPLAY_MINUTES),
        endMinutes,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const blocks: TimelineBlock[] = [];
  let group: TimelineBlock[] = [];
  let groupEnd = -1;
  let laneEnds: number[] = [];

  const closeGroup = () => {
    group.forEach((block) => {
      block.columns = laneEnds.length;
    });
    blocks.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const span of spans) {
    if (span.startMinutes >= groupEnd && group.length > 0) {
      closeGroup();
    }
    let column = laneEnds.findIndex((end) => end <= span.startMinutes);
    if (column === -1) {
      column = laneEnds.length;
      laneEnds.push(span.endMinutes);
    } else {
      laneEnds[column] = span.endMinutes;
    }
    group.push({ ...span, column, columns: 1 });
    groupEnd = Math.max(groupEnd, span.endMinutes);
  }
  closeGroup();
  return blocks;
}

export interface DragMetrics {
  /** Width of one day column in px; 0 disables horizontal movement (single-day view). */
  columnWidth: number;
  hourHeight: number;
  stepMinutes?: number;
  /** Days run right to left, so dragging to the right goes back in time. */
  reverseDays?: boolean;
}

export interface TimeShift {
  days: number;
  minutes: number;
}

/** Converts a drag distance in px into whole days and snapped minutes. */
export function dragToShift(dx: number, dy: number, metrics: DragMetrics): TimeShift {
  const step = metrics.stepMinutes ?? SNAP_MINUTES;
  const direction = metrics.reverseDays === true ? -1 : 1;
  const days = metrics.columnWidth > 0 ? Math.round((dx * direction) / metrics.columnWidth) : 0;
  const minutes = Math.round((dy / metrics.hourHeight) * (60 / step)) * step;
  return { days: days === 0 ? 0 : days, minutes: minutes === 0 ? 0 : minutes };
}

/** Moves a timestamp by whole calendar days then minutes, keeping the wall-clock time across DST. */
export function shiftTime(ms: number, shift: TimeShift): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + shift.days);
  date.setMinutes(date.getMinutes() + shift.minutes);
  return date.getTime();
}

export function isNoShift(shift: TimeShift): boolean {
  return shift.days === 0 && shift.minutes === 0;
}
