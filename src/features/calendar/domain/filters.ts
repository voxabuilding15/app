import { NO_CATEGORY } from '@/core';

import type { CalendarItem } from './items';

export type ItemKind = CalendarItem['kind'];

export interface CalendarFilter {
  /** Which kinds of items to show. */
  kinds: Record<ItemKind, boolean>;
  /** Limits events to one category (or uncategorized); tasks and habits are unaffected. */
  categoryId: string | null;
  search: string;
}

export const DEFAULT_CALENDAR_FILTER: CalendarFilter = {
  kinds: { event: true, task: true, habit: true },
  categoryId: null,
  search: '',
};

/** Number of filters in effect (search is shown separately). */
export function countActiveCalendarFilters(filter: CalendarFilter): number {
  const hidden = Object.values(filter.kinds).filter((shown) => !shown).length;
  return hidden + (filter.categoryId !== null ? 1 : 0);
}

function matchesText(item: CalendarItem, term: string): boolean {
  const haystack =
    item.kind === 'event' ? `${item.title}\n${item.location}\n${item.notes}` : item.title;
  return haystack.toLowerCase().includes(term);
}

export function filterItems(
  items: readonly CalendarItem[],
  filter: CalendarFilter,
): CalendarItem[] {
  const term = filter.search.trim().toLowerCase();

  return items.filter((item) => {
    if (!filter.kinds[item.kind]) {
      return false;
    }
    if (item.kind === 'event' && filter.categoryId !== null) {
      const matches =
        filter.categoryId === NO_CATEGORY
          ? item.categoryId === null
          : item.categoryId === filter.categoryId;
      if (!matches) {
        return false;
      }
    }
    return term === '' || matchesText(item, term);
  });
}
