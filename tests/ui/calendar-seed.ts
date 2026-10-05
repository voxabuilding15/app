import { act } from '@testing-library/react-native';

import { startOfDay } from '@/core';
import type { EventDraft } from '@/features/calendar/domain/validation';

import type { TestApp } from './harness';

export const HOUR = 3_600_000;

/** Local midnight today, so seeded events always land in the visible period. */
export const todayStart = () => startOfDay(Date.now());

export function eventDraft(overrides: Partial<EventDraft> = {}): EventDraft {
  const start = todayStart() + 10 * HOUR;
  return {
    title: 'Planning',
    notes: '',
    location: '',
    categoryId: null,
    allDay: false,
    start,
    end: start + HOUR,
    recurrence: null,
    reminderOffsetMinutes: null,
    ...overrides,
  };
}

export async function seedEvents(app: TestApp, drafts: Partial<EventDraft>[]): Promise<string[]> {
  const ids: string[] = [];
  await act(async () => {
    for (const draft of drafts) {
      const result = await app.calendar.save(eventDraft(draft), { kind: 'new' });
      if (!result.ok) {
        throw new Error('seed failed');
      }
      ids.push(result.id);
    }
    await app.client.invalidateQueries({ queryKey: ['calendar'] });
  });
  return ids;
}

/** Lets pending promise work finish inside act, for asserting that nothing happened. */
export const settle = () =>
  act(async () => void (await new Promise((resolve) => setTimeout(resolve, 50))));
