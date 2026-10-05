import {
  addDaysToKey,
  combineDayAndTime,
  dateKeyToNoon,
  daysBetweenKeys,
  occurrenceKeys,
  startOfDay,
  toDateKey,
  type DateKey,
} from '@/core';

import type { EventEntry, EventOccurrence } from './entities';

/** Hard stop for a single expansion, far beyond any sensible visible range. */
const MAX_ITERATIONS = 20_000;

function occurrenceOn({ event }: EventEntry, day: DateKey): Pick<EventOccurrence, 'start' | 'end'> {
  if (event.allDay) {
    const spanDays = daysBetweenKeys(toDateKey(event.start), toDateKey(event.end));
    return {
      start: startOfDay(dateKeyToNoon(day)),
      end: startOfDay(dateKeyToNoon(addDaysToKey(day, spanDays))),
    };
  }
  const start = combineDayAndTime(dateKeyToNoon(day), event.start);
  return { start, end: start + (event.end - event.start) };
}

/** Every occurrence of an event that overlaps the half-open range [from, to). */
export function expandEvent(entry: EventEntry, from: number, to: number): EventOccurrence[] {
  const { event, exceptions } = entry;
  const found: EventOccurrence[] = [];
  const overlaps = (start: number, end: number) => start < to && end > from;

  if (event.recurrence === null) {
    if (overlaps(event.start, event.end)) {
      found.push({
        event,
        occurrenceDate: toDateKey(event.start),
        start: event.start,
        end: event.end,
      });
    }
    return found;
  }

  const { until, count } = event.recurrence;
  const skipped = new Set(exceptions);
  let index = 0;

  for (const day of occurrenceKeys(event.recurrence, toDateKey(event.start))) {
    if (index >= MAX_ITERATIONS || (count !== null && index >= count)) {
      break;
    }
    if (until !== null && day > until) {
      break;
    }
    index += 1;

    const { start, end } = occurrenceOn(entry, day);
    if (start >= to) {
      break;
    }
    // Deleted or individually edited occurrences still count towards a limited series.
    if (!skipped.has(day) && overlaps(start, end)) {
      found.push({ event, occurrenceDate: day, start, end });
    }
  }
  return found;
}

/** The occurrence of an event on a specific day, if it has one. */
export function occurrenceForDay(entry: EventEntry, day: DateKey): EventOccurrence | null {
  const dayStart = startOfDay(dateKeyToNoon(day));
  const dayEnd = startOfDay(dateKeyToNoon(addDaysToKey(day, 1)));
  return expandEvent(entry, dayStart, dayEnd).find((o) => o.occurrenceDate === day) ?? null;
}
