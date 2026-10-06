import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { pickDate, pickTime, showRemindersBlockedAlert } from '@/components';
import {
  MAX_RECURRENCE_INTERVAL,
  addDays,
  addDaysToKey,
  combineDayAndTime,
  dateKeyToNoon,
  ruleForRecurrencePreset,
  startOfDay,
  toDateKey,
  type DateKey,
  type RecurrencePreset,
} from '@/core';
import { useDiscardGuard, useNow } from '@/hooks';
import { useTranslator } from '@/i18n';

import type { EventEntry, EventRecurrence } from '../../domain/entities';
import { occurrenceForDay } from '../../domain/occurrences';
import type { SaveTarget } from '../../domain/usecases';
import {
  MAX_OCCURRENCE_COUNT,
  eventReminderOffsetsFor,
  type EventDraft,
  type EventDraftErrors,
  type EventDraftField,
} from '../../domain/validation';
import { useCalendarModule } from '../module';
import { useEvent, useEventCategories, useInvalidateCalendar } from '../queries';
import { askScope } from '../scope-prompt';

const HOUR_MS = 3_600_000;
const DEFAULT_DAY_START_HOUR = 9;
const DEFAULT_REPEAT_END_DAYS = 30;
const DEFAULT_REPEAT_COUNT = 10;

export type RepeatEnd = 'never' | 'until' | 'count';

export interface NewEventDefaults {
  /** Day to create the event on; today when null. */
  day: DateKey | null;
  /** Start time as minutes after midnight; a sensible default when null. */
  minutes: number | null;
}

function draftFromEvent(entry: EventEntry, occurrenceDate: DateKey | null): EventDraft {
  const { event } = entry;
  const occurrence = occurrenceDate === null ? null : occurrenceForDay(entry, occurrenceDate);
  const { category, ...rest } = event;
  return {
    title: rest.title,
    notes: rest.notes,
    location: rest.location,
    categoryId: category?.id ?? null,
    allDay: rest.allDay,
    start: occurrence?.start ?? rest.start,
    end: occurrence?.end ?? rest.end,
    recurrence: rest.recurrence,
    reminderOffsetMinutes: rest.reminderOffsetMinutes,
  };
}

export type EventLoadState =
  | { phase: 'loading' }
  | { phase: 'notFound' }
  | { phase: 'failed'; retry: () => void }
  | { phase: 'ready'; initial: EventDraft; series: EventEntry | null };

/** Loads the event to edit, or builds the starting draft for a new one. */
export function useEventLoader(
  eventId: string | null,
  occurrenceDate: DateKey | null,
  defaults: NewEventDefaults,
): EventLoadState {
  // The suggested start time is fixed when the form opens, not recomputed as the clock ticks.
  const [openedAt] = useState(useNow());
  const query = useEvent(eventId);
  const { data, isPending, isError, refetch } = query;

  const initial = useMemo<EventDraft>(() => {
    if (data) {
      return draftFromEvent(data, occurrenceDate);
    }
    const day = defaults.day ?? toDateKey(openedAt);
    const nowDate = new Date(openedAt);
    const fallbackMinutes =
      day === toDateKey(openedAt)
        ? Math.min(22 * 60, (nowDate.getHours() + 1) * 60)
        : DEFAULT_DAY_START_HOUR * 60;
    const minutes = defaults.minutes ?? fallbackMinutes;
    const start = startOfDay(dateKeyToNoon(day)) + minutes * 60_000;
    return {
      title: '',
      notes: '',
      location: '',
      categoryId: null,
      allDay: false,
      start,
      end: start + HOUR_MS,
      recurrence: null,
      reminderOffsetMinutes: null,
    };
  }, [data, occurrenceDate, defaults.day, defaults.minutes, openedAt]);

  if (eventId === null) {
    return { phase: 'ready', initial, series: null };
  }
  if (isPending) {
    return { phase: 'loading' };
  }
  if (isError) {
    return { phase: 'failed', retry: () => void refetch() };
  }
  return data === null || data === undefined
    ? { phase: 'notFound' }
    : { phase: 'ready', initial, series: data };
}

function repeatEndOf(rule: EventRecurrence | null): RepeatEnd {
  return rule?.until ? 'until' : rule?.count ? 'count' : 'never';
}

/** Editing state for one event. `eventId` null creates a new event. */
export function useEventFormViewModel(
  eventId: string | null,
  occurrenceDate: DateKey | null,
  initial: EventDraft,
  series: EventEntry | null,
) {
  const { t } = useTranslator();
  const router = useRouter();
  const { calendar } = useCalendarModule();
  const invalidate = useInvalidateCalendar();
  const categories = useEventCategories();

  const [draft, setDraft] = useState<EventDraft>(initial);
  const [baseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<EventDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = useMemo(() => JSON.stringify(draft) !== baseline, [draft, baseline]);
  const allowLeaving = useDiscardGuard(isDirty, saving);
  const isRecurringEdit = series?.event.recurrence != null;

  const update = useCallback(
    (changes: Partial<EventDraft>, clears: readonly EventDraftField[] = []) => {
      setDraft((current) => ({ ...current, ...changes }));
      setSaveError(null);
      if (clears.length > 0) {
        setErrors((current) => {
          const next = { ...current };
          clears.forEach((field) => delete next[field]);
          return next;
        });
      }
    },
    [],
  );

  const duration = draft.end - draft.start;
  /** Days an all-day event covers (at least one). */
  const spanDays = Math.max(1, Math.round(duration / 86_400_000));

  const setAllDay = useCallback(
    (allDay: boolean) => {
      const reminder = draft.reminderOffsetMinutes;
      const keepReminder = reminder !== null && eventReminderOffsetsFor(allDay).includes(reminder);
      if (allDay) {
        const start = startOfDay(draft.start);
        update(
          {
            allDay,
            start,
            end: startOfDay(addDays(start, 1)),
            reminderOffsetMinutes: keepReminder ? reminder : null,
          },
          ['time', 'reminder'],
        );
      } else {
        const start = startOfDay(draft.start) + DEFAULT_DAY_START_HOUR * HOUR_MS;
        update(
          {
            allDay,
            start,
            end: start + HOUR_MS,
            reminderOffsetMinutes: keepReminder ? reminder : null,
          },
          ['time', 'reminder'],
        );
      }
    },
    [draft.start, draft.reminderOffsetMinutes, update],
  );

  const setStartDay = useCallback(
    (day: DateKey) => {
      const start = combineDayAndTime(dateKeyToNoon(day), draft.start);
      const end = draft.allDay ? startOfDay(addDays(start, spanDays)) : start + duration;
      update({ start: draft.allDay ? startOfDay(start) : start, end }, ['time']);
    },
    [draft.start, draft.allDay, duration, spanDays, update],
  );

  const setStartTime = useCallback(
    (time: Date) => {
      const start = combineDayAndTime(draft.start, time.getTime());
      update({ start, end: start + duration }, ['time']);
    },
    [draft.start, duration, update],
  );

  /** For all-day events `day` is the last day (inclusive); otherwise the end's calendar day. */
  const setEndDay = useCallback(
    (day: DateKey) => {
      const end = draft.allDay
        ? startOfDay(dateKeyToNoon(addDaysToKey(day, 1)))
        : combineDayAndTime(dateKeyToNoon(day), draft.end);
      update({ end }, ['time']);
    },
    [draft.allDay, draft.end, update],
  );

  const setEndTime = useCallback(
    (time: Date) => update({ end: combineDayAndTime(draft.end, time.getTime()) }, ['time']),
    [draft.end, update],
  );

  const pick = useCallback(
    async (kind: 'startDay' | 'startTime' | 'endDay' | 'endTime') => {
      const target = kind.startsWith('start')
        ? draft.start
        : draft.allDay
          ? draft.end - 1
          : draft.end;
      if (kind.endsWith('Day')) {
        const picked = await pickDate(new Date(target));
        if (picked !== null) {
          (kind === 'startDay' ? setStartDay : setEndDay)(toDateKey(picked.getTime()));
        }
      } else {
        const picked = await pickTime(new Date(target));
        if (picked !== null) {
          (kind === 'startTime' ? setStartTime : setEndTime)(picked);
        }
      }
    },
    [draft.start, draft.end, draft.allDay, setStartDay, setStartTime, setEndDay, setEndTime],
  );

  const setRepeatPreset = useCallback(
    (preset: RecurrencePreset) => {
      const rule = ruleForRecurrencePreset(preset, draft.recurrence);
      update({ recurrence: rule === null ? null : { ...rule, until: null, count: null } }, [
        'repeat',
      ]);
    },
    [draft.recurrence, update],
  );

  const changeRepeat = useCallback(
    (changes: Partial<EventRecurrence>) => {
      if (draft.recurrence === null) {
        return;
      }
      const next = { ...draft.recurrence, ...changes };
      next.interval = Math.min(
        MAX_RECURRENCE_INTERVAL,
        Math.max(1, Math.round(next.interval) || 1),
      );
      if (next.unit !== 'week') {
        next.weekdays = 0;
      }
      update({ recurrence: next }, ['repeat']);
    },
    [draft.recurrence, update],
  );

  const setRepeatEnd = useCallback(
    (end: RepeatEnd) => {
      if (draft.recurrence === null) {
        return;
      }
      const base = { ...draft.recurrence, until: null, count: null };
      const recurrence: EventRecurrence =
        end === 'until'
          ? { ...base, until: addDaysToKey(toDateKey(draft.start), DEFAULT_REPEAT_END_DAYS) }
          : end === 'count'
            ? { ...base, count: DEFAULT_REPEAT_COUNT }
            : base;
      update({ recurrence }, ['repeat']);
    },
    [draft.recurrence, draft.start, update],
  );

  const chooseRepeatUntil = useCallback(async () => {
    if (draft.recurrence === null) {
      return;
    }
    const current = draft.recurrence.until ?? toDateKey(draft.start);
    const picked = await pickDate(new Date(dateKeyToNoon(current)));
    if (picked !== null) {
      changeRepeat({ until: toDateKey(picked.getTime()), count: null });
    }
  }, [draft.recurrence, draft.start, changeRepeat]);

  const setRepeatCount = useCallback(
    (count: number) =>
      changeRepeat({ count: Math.min(MAX_OCCURRENCE_COUNT, Math.max(1, count)), until: null }),
    [changeRepeat],
  );

  const createCategory = useCallback(
    async (name: string, color: string): Promise<string | null> => {
      try {
        const result = await calendar.categories.save({ id: null, name, color });
        if (!result.ok) {
          return result.error;
        }
        await invalidate();
        update({ categoryId: result.id });
        return null;
      } catch {
        return t("Couldn't save. Please try again.");
      }
    },
    [calendar, invalidate, update, t],
  );

  const finish = useCallback(() => {
    allowLeaving();
    router.back();
  }, [allowLeaving, router]);

  const save = useCallback(async () => {
    if (saving) {
      return;
    }
    let target: SaveTarget = eventId === null ? { kind: 'new' } : { kind: 'event', id: eventId };
    if (eventId !== null && isRecurringEdit) {
      const scope = await askScope(
        t('Save recurring event'),
        t('Apply your changes to just this event, or to all events in the series?'),
      );
      if (scope === null) {
        return;
      }
      target = {
        kind: 'occurrence',
        id: eventId,
        occurrenceDate: occurrenceDate ?? toDateKey(initial.start),
        scope,
      };
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await calendar.save(draft, target);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      await invalidate();
      if (result.reminder === 'blocked') {
        showRemindersBlockedAlert();
      }
      finish();
    } catch {
      setSaveError(t("Couldn't save the event. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    eventId,
    isRecurringEdit,
    occurrenceDate,
    initial.start,
    calendar,
    draft,
    invalidate,
    finish,
    t,
  ]);

  const deleteEvent = useCallback(async () => {
    if (eventId === null) {
      return;
    }
    const day = occurrenceDate ?? toDateKey(initial.start);
    const remove = async (scope: 'this' | 'all') => {
      try {
        await calendar.remove(eventId, day, scope);
        await invalidate();
        finish();
      } catch {
        setSaveError(t("Couldn't delete the event. Please try again."));
      }
    };

    if (isRecurringEdit) {
      const scope = await askScope(
        t('Delete recurring event'),
        t('Delete just this event, or all events in the series?'),
      );
      if (scope !== null) {
        await remove(scope);
      }
      return;
    }
    Alert.alert(t('Delete this event?'), t('This permanently removes the event.'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete'), style: 'destructive', onPress: () => void remove('all') },
    ]);
  }, [eventId, occurrenceDate, initial.start, isRecurringEdit, calendar, invalidate, finish, t]);

  return {
    isEditing: eventId !== null,
    isRecurringEdit,
    draft,
    errors,
    saving,
    saveError,
    categories: categories.data ?? [],
    repeatEnd: repeatEndOf(draft.recurrence),
    setTitle: (title: string) => update({ title }, ['title']),
    setNotes: (notes: string) => update({ notes }, ['notes']),
    setLocation: (location: string) => update({ location }, ['location']),
    setCategory: (categoryId: string | null) => update({ categoryId }),
    setAllDay,
    pick,
    setRepeatPreset,
    changeRepeat,
    setRepeatEnd,
    chooseRepeatUntil,
    setRepeatCount,
    setReminder: (reminderOffsetMinutes: number | null) =>
      update({ reminderOffsetMinutes }, ['reminder']),
    createCategory,
    save,
    deleteEvent,
  };
}
