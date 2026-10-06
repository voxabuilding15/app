import { useCallback, useMemo, useState } from 'react';

import { toDateKey, type DateKey } from '@/core';
import { useDebouncedValue, useNow, useOnAppForeground } from '@/hooks';

import {
  DEFAULT_CALENDAR_FILTER,
  countActiveCalendarFilters,
  type CalendarFilter,
  type ItemKind,
} from '../../domain/filters';
import { itemsOnDay, type CalendarItem, type EventItem } from '../../domain/items';
import type { TimeShift } from '../../domain/timeline';
import { stepAnchor, visibleRange, type CalendarView } from '../../domain/views';
import { useCalendarModule } from '../module';
import {
  useCalendarItems,
  useCalendarSearch,
  useEventCategories,
  useInvalidateCalendar,
} from '../queries';
import { askScope } from '../scope-prompt';
import { useTranslator } from '@/i18n';

const SEARCH_DEBOUNCE_MS = 250;
const NO_ITEMS: readonly CalendarItem[] = [];

export function useCalendarViewModel() {
  const { t } = useTranslator();
  const { calendar } = useCalendarModule();
  const invalidate = useInvalidateCalendar();
  const now = useNow();
  const today = toDateKey(now);

  const [view, setViewState] = useState<CalendarView>('month');
  // The day the user navigated to; until they do, the calendar follows today.
  const [chosenDay, setChosenDay] = useState<DateKey | null>(null);
  const anchor = chosenDay ?? today;

  const [kinds, setKinds] = useState<CalendarFilter['kinds']>(DEFAULT_CALENDAR_FILTER.kinds);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const filter = useMemo<CalendarFilter>(
    () => ({ kinds, categoryId, search }),
    [kinds, categoryId, search],
  );

  const range = useMemo(() => visibleRange(view, anchor), [view, anchor]);
  const items = useCalendarItems(range.from, range.to, filter);
  const results = useCalendarSearch(filter);
  const categories = useEventCategories();

  const visibleItems = items.data ?? NO_ITEMS;
  const dayItems = useMemo(() => itemsOnDay(visibleItems, anchor), [visibleItems, anchor]);

  // Tasks and habits are edited on other screens, so refresh whenever the app comes back.
  useOnAppForeground(() => void invalidate());

  const run = useCallback(
    async (action: () => Promise<unknown>, failure: string) => {
      try {
        await action();
      } catch {
        setNotice(failure);
      }
      await invalidate();
    },
    [invalidate],
  );

  /** Moves an event by `shift`, asking first whether to move one occurrence or the series. */
  const moveEvent = useCallback(
    async (item: EventItem, shift: TimeShift) => {
      const scope = item.recurring
        ? await askScope(
            t('Move recurring event'),
            t('Move just this event, or all events in the series?'),
          )
        : 'all';
      if (scope === null) {
        await invalidate(); // snap the dragged block back
        return;
      }
      await run(async () => {
        await calendar.move(item.eventId, item.occurrenceDate, shift, scope);
        setNotice(t('Event moved'));
      }, t("Couldn't move the event"));
    },
    [calendar, invalidate, run, t],
  );

  const setView = useCallback((next: CalendarView) => setViewState(next), []);

  return {
    view,
    anchor,
    today,
    now,
    range,
    filter,
    searchText,
    searchOpen,
    isSearching: search !== '',
    activeFilterCount: countActiveCalendarFilters(filter),
    isFiltering: countActiveCalendarFilters(filter) > 0 || search !== '',
    items: visibleItems,
    dayItems,
    searchResults: results.data ?? NO_ITEMS,
    categories: categories.data ?? [],
    isLoading: items.isPending,
    isError: items.isError,
    isSearchLoading: results.isFetching,
    notice,
    setView,
    goPrevious: () => setChosenDay(stepAnchor(view, anchor, -1)),
    goNext: () => setChosenDay(stepAnchor(view, anchor, 1)),
    goToday: () => setChosenDay(null),
    selectDay: (day: DateKey) => setChosenDay(day),
    /** Jumps to a day in the day view, e.g. from a week header or a search result. */
    openDay: (day: DateKey) => {
      setChosenDay(day);
      setViewState('day');
      setSearchText('');
      setSearchOpen(false);
    },
    toggleKind: (kind: ItemKind) => setKinds((current) => ({ ...current, [kind]: !current[kind] })),
    setCategoryId,
    resetFilters: () => {
      setKinds(DEFAULT_CALENDAR_FILTER.kinds);
      setCategoryId(null);
      setSearchText('');
    },
    setSearchText,
    toggleSearch: () =>
      setSearchOpen((open) => {
        if (open) {
          setSearchText('');
        }
        return !open;
      }),
    refetch: items.refetch,
    moveEvent,
    dismissNotice: useCallback(() => setNotice(null), []),
  };
}
