import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Category, DateKey } from '@/core';

import type { EventEntry } from '../domain/entities';
import type { CalendarFilter } from '../domain/filters';
import type { CalendarItem } from '../domain/items';

import { useCalendarModule } from './module';

const ROOT = ['calendar'] as const;

/** Items for the visible range. Text search is handled separately, so it is not part of the key. */
export function useCalendarItems(
  from: DateKey,
  to: DateKey,
  filter: CalendarFilter,
): UseQueryResult<CalendarItem[]> {
  const { calendar } = useCalendarModule();
  return useQuery({
    queryKey: [...ROOT, 'items', from, to, filter.kinds, filter.categoryId],
    queryFn: () => calendar.items(from, to, { ...filter, search: '' }),
    placeholderData: keepPreviousData,
  });
}

export function useCalendarSearch(filter: CalendarFilter): UseQueryResult<CalendarItem[]> {
  const { calendar } = useCalendarModule();
  const term = filter.search.trim();
  return useQuery({
    queryKey: [...ROOT, 'search', term, filter.kinds, filter.categoryId],
    queryFn: () => calendar.search(filter),
    enabled: term !== '',
  });
}

export function useEvent(id: string | null): UseQueryResult<EventEntry | null> {
  const { calendar } = useCalendarModule();
  return useQuery({
    queryKey: [...ROOT, 'event', id ?? ''],
    queryFn: () => (id === null ? null : calendar.event(id)),
    enabled: id !== null,
    gcTime: 0,
  });
}

export function useEventCategories(): UseQueryResult<Category[]> {
  const { calendar } = useCalendarModule();
  return useQuery({ queryKey: [...ROOT, 'categories'], queryFn: () => calendar.categories.list() });
}

/** Refreshes every Calendar query after a write or when tasks and habits may have changed. */
export function useInvalidateCalendar(): () => Promise<void> {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: ROOT }), [client]);
}
