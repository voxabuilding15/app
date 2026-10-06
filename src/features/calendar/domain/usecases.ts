import {
  addDays,
  addDaysToKey,
  createCategoryUseCases,
  createId,
  daysBetweenKeys,
  reminderInstant,
  startOfDay,
  toDateKey,
  type CategoryRepository,
  type Clock,
  type DateKey,
} from '@/core';

import type { EventEntry, EventRecord } from './entities';
import { DEFAULT_CALENDAR_FILTER, filterItems, type CalendarFilter } from './filters';
import { dayBounds, eventItemFrom, sortItems, type CalendarItem } from './items';
import { expandEvent, occurrenceForDay } from './occurrences';
import type {
  EventReminderScheduler,
  EventRepository,
  HabitAgendaSource,
  TaskAgendaSource,
} from './ports';
import { isNoShift, shiftTime, type TimeShift } from './timeline';
import {
  hasEventErrors,
  validateEventDraft,
  type EventDraft,
  type EventDraftErrors,
} from './validation';
import { currentTranslator } from '@/i18n/translate';

export type ReminderStatus = 'none' | 'scheduled' | 'blocked';

/** What a save applies to. `this` edits one occurrence of a series; `all` edits the series. */
export type EditScope = 'this' | 'all';

export type SaveTarget =
  | { kind: 'new' }
  | { kind: 'event'; id: string }
  | { kind: 'occurrence'; id: string; occurrenceDate: DateKey; scope: EditScope };

export type SaveEventResult =
  { ok: true; id: string; reminder: ReminderStatus } | { ok: false; errors: EventDraftErrors };

/** Reminders are scheduled for occurrences this far ahead, and refreshed when the app opens. */
const REMINDER_HORIZON_DAYS = 30;
const MAX_REMINDERS_PER_EVENT = 12;

/** Search looks this far back and ahead of today, and returns at most this many results. */
const SEARCH_DAYS_BACK = 30;
const SEARCH_DAYS_AHEAD = 365;
const SEARCH_LIMIT = 200;

interface CalendarUseCaseDeps {
  events: EventRepository;
  categories: CategoryRepository;
  tasks: TaskAgendaSource;
  habits: HabitAgendaSource;
  reminders: EventReminderScheduler;
  clock: Clock;
}

function clockMinutes(ms: number): number {
  const date = new Date(ms);
  return date.getHours() * 60 + date.getMinutes();
}

/** Normalizes a draft: all-day events snap to whole days and a missing repeat stays null. */
function normalize(draft: EventDraft): EventDraft {
  if (!draft.allDay) {
    return draft;
  }
  const start = startOfDay(draft.start);
  const lastDayEnd = startOfDay(draft.end);
  return { ...draft, start, end: Math.max(lastDayEnd, startOfDay(addDays(start, 1))) };
}

function toRecord(
  draft: EventDraft,
  base: Pick<EventRecord, 'id' | 'createdAt'>,
  now: number,
): EventRecord {
  return {
    ...base,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    location: draft.location.trim(),
    categoryId: draft.categoryId,
    start: draft.start,
    end: draft.end,
    allDay: draft.allDay,
    recurrence: draft.recurrence,
    reminderOffsetMinutes: draft.reminderOffsetMinutes,
    updatedAt: now,
  };
}

function recordOf({ event }: EventEntry): EventRecord {
  const { category, ...rest } = event;
  return { ...rest, categoryId: category?.id ?? null };
}

export function createCalendarUseCases({
  events,
  categories,
  tasks,
  habits,
  reminders,
  clock,
}: CalendarUseCaseDeps) {
  const { t } = currentTranslator();
  /** Brings the scheduled notifications in line with an event's upcoming occurrences. */
  async function syncReminders(entry: EventEntry): Promise<ReminderStatus> {
    await reminders.cancel(entry.notificationIds);
    const { event } = entry;

    if (event.reminderOffsetMinutes === null) {
      await events.setNotificationIds(event.id, []);
      return 'none';
    }

    const now = clock.now();
    const horizon = addDays(now, REMINDER_HORIZON_DAYS);
    const offset = event.reminderOffsetMinutes;
    const due = expandEvent(entry, now - 2 * 86_400_000, horizon)
      .map((occurrence) => ({
        occurrence,
        fireAt: reminderInstant(occurrence.start, !event.allDay, offset),
      }))
      .filter(({ fireAt }) => fireAt > now)
      .sort((a, b) => a.fireAt - b.fireAt)
      .slice(0, MAX_REMINDERS_PER_EVENT);

    if (due.length === 0) {
      await events.setNotificationIds(event.id, []);
      return 'none';
    }

    const outcome = await reminders.schedule(
      due.map(({ occurrence, fireAt }) => ({
        eventId: event.id,
        occurrenceDate: occurrence.occurrenceDate,
        title: event.title,
        body: event.location || (offset === 0 ? t('Starting now') : t('Coming up')),
        fireAt,
      })),
    );
    if (outcome.status === 'blocked') {
      await events.setNotificationIds(event.id, []);
      return 'blocked';
    }
    await events.setNotificationIds(event.id, outcome.notificationIds);
    return 'scheduled';
  }

  async function resync(id: string): Promise<ReminderStatus> {
    const entry = await events.get(id);
    return entry === null ? 'none' : syncReminders(entry);
  }

  async function requireEntry(id: string): Promise<EventEntry> {
    const entry = await events.get(id);
    if (entry === null) {
      throw new Error(t('This event no longer exists.'));
    }
    return entry;
  }

  /** Shifts a whole series (or a single event) by the same wall-clock amount. */
  function shiftedSeries(entry: EventEntry, shift: TimeShift, durationFrom?: EventDraft) {
    const { event } = entry;
    const start = shiftTime(event.start, shift);
    if (durationFrom?.allDay) {
      const span = daysBetweenKeys(toDateKey(durationFrom.start), toDateKey(durationFrom.end));
      return { start, end: startOfDay(addDays(start, span)) };
    }
    return {
      start,
      end: durationFrom
        ? start + (durationFrom.end - durationFrom.start)
        : shiftTime(event.end, shift),
    };
  }

  /** Detaches one occurrence of a series: it is hidden from the series and re-created standalone. */
  async function detachOccurrence(
    entry: EventEntry,
    occurrenceDate: DateKey,
    changes: Partial<EventRecord>,
    now: number,
  ): Promise<string> {
    const occurrence = occurrenceForDay(entry, occurrenceDate);
    if (occurrence === null) {
      throw new Error(t('This occurrence no longer exists.'));
    }
    await events.addException(entry.event.id, occurrenceDate);
    const id = createId();
    await events.insert({
      ...recordOf(entry),
      id,
      start: occurrence.start,
      end: occurrence.end,
      recurrence: null,
      createdAt: now,
      updatedAt: now,
      ...changes,
    });
    return id;
  }

  async function itemsBetween(
    from: number,
    to: number,
    fromKey: DateKey,
    toKey: DateKey,
    filter: CalendarFilter,
  ) {
    const today = toDateKey(clock.now());
    const [entries, taskItems, habitItems] = await Promise.all([
      filter.kinds.event ? events.listInRange(from, to) : Promise.resolve([]),
      filter.kinds.task ? tasks.dueBetween(from, to) : Promise.resolve([]),
      filter.kinds.habit ? habits.between(fromKey, toKey, today) : Promise.resolve([]),
    ]);
    const all: CalendarItem[] = [
      ...entries.flatMap((entry) => expandEvent(entry, from, to).map(eventItemFrom)),
      ...taskItems,
      ...habitItems,
    ];
    return sortItems(filterItems(all, filter));
  }

  return {
    categories: createCategoryUseCases(categories),

    /** Everything on the calendar between two days (inclusive). */
    items(fromKey: DateKey, toKey: DateKey, filter: CalendarFilter = DEFAULT_CALENDAR_FILTER) {
      return itemsBetween(dayBounds(fromKey).start, dayBounds(toKey).end, fromKey, toKey, filter);
    },

    /** Matches across a wide window around today, nearest first. */
    async search(filter: CalendarFilter): Promise<CalendarItem[]> {
      const today = toDateKey(clock.now());
      const fromKey = addDaysToKey(today, -SEARCH_DAYS_BACK);
      const toKey = addDaysToKey(today, SEARCH_DAYS_AHEAD);
      const found = await itemsBetween(
        dayBounds(fromKey).start,
        dayBounds(toKey).end,
        fromKey,
        toKey,
        filter,
      );
      return found.slice(0, SEARCH_LIMIT);
    },

    event(id: string): Promise<EventEntry | null> {
      return events.get(id);
    },

    async save(draft: EventDraft, target: SaveTarget): Promise<SaveEventResult> {
      const normalized = normalize(draft);
      const errors = validateEventDraft(normalized);
      if (hasEventErrors(errors)) {
        return { ok: false, errors };
      }
      const now = clock.now();
      let savedId: string;
      const touched = new Set<string>();

      if (target.kind === 'new') {
        savedId = createId();
        await events.insert(toRecord(normalized, { id: savedId, createdAt: now }, now));
        touched.add(savedId);
      } else {
        const entry = await requireEntry(target.id);
        savedId = entry.event.id;
        touched.add(savedId);

        if (target.kind === 'event') {
          await events.update(
            toRecord(normalized, { id: savedId, createdAt: entry.event.createdAt }, now),
          );
        } else if (target.scope === 'this') {
          const detached = await detachOccurrence(
            entry,
            target.occurrenceDate,
            {
              ...toRecord(normalized, { id: '', createdAt: now }, now),
              recurrence: null,
            },
            now,
          );
          savedId = detached;
          touched.add(detached);
        } else {
          // Editing every occurrence: apply the change in day and time to the whole series.
          const occurrence = occurrenceForDay(entry, target.occurrenceDate);
          if (occurrence === null) {
            throw new Error(t('This occurrence no longer exists.'));
          }
          const shift: TimeShift = {
            days: daysBetweenKeys(target.occurrenceDate, toDateKey(normalized.start)),
            minutes: clockMinutes(normalized.start) - clockMinutes(occurrence.start),
          };
          const series = shiftedSeries(entry, shift, normalized);
          await events.update({
            ...toRecord(normalized, { id: savedId, createdAt: entry.event.createdAt }, now),
            ...series,
          });
        }
      }

      const statuses: ReminderStatus[] = [];
      for (const id of touched) {
        statuses.push(await resync(id));
      }
      const reminder: ReminderStatus = statuses.includes('blocked')
        ? 'blocked'
        : statuses.includes('scheduled')
          ? 'scheduled'
          : 'none';
      return { ok: true, id: savedId, reminder };
    },

    /** Moves an occurrence (or a one-off event) by a number of days and minutes. */
    async move(
      id: string,
      occurrenceDate: DateKey,
      shift: TimeShift,
      scope: EditScope,
    ): Promise<void> {
      if (isNoShift(shift)) {
        return;
      }
      const entry = await requireEntry(id);
      const now = clock.now();
      const touched = [id];

      if (entry.event.recurrence !== null && scope === 'this') {
        const occurrence = occurrenceForDay(entry, occurrenceDate);
        if (occurrence === null) {
          throw new Error(t('This occurrence no longer exists.'));
        }
        const start = shiftTime(occurrence.start, shift);
        touched.push(
          await detachOccurrence(
            entry,
            occurrenceDate,
            { start, end: start + (occurrence.end - occurrence.start) },
            now,
          ),
        );
      } else {
        const series = shiftedSeries(entry, shift);
        await events.update({ ...recordOf(entry), ...series, updatedAt: now });
      }
      for (const touchedId of touched) {
        await resync(touchedId);
      }
    },

    async remove(id: string, occurrenceDate: DateKey, scope: EditScope): Promise<void> {
      const entry = await requireEntry(id);
      if (entry.event.recurrence !== null && scope === 'this') {
        await events.addException(id, occurrenceDate);
        await resync(id);
        return;
      }
      await reminders.cancel(entry.notificationIds);
      await events.delete(id);
    },

    /** Re-plans upcoming reminders for every event; run on launch and when the app resumes. */
    async refreshReminders(): Promise<void> {
      for (const entry of await events.listWithReminders(clock.now())) {
        await syncReminders(entry);
      }
    },
  };
}

export type CalendarUseCases = ReturnType<typeof createCalendarUseCases>;
