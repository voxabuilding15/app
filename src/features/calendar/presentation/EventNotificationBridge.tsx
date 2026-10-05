import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';

import type { NotificationResponse } from '@/core';
import { useNotificationResponses, useOnAppForeground } from '@/hooks';

import { useCalendarModule } from './module';
import { useInvalidateCalendar } from './queries';

/**
 * Headless component that opens an event when its reminder is tapped, and keeps upcoming reminders
 * planned: recurring events only have their next few occurrences scheduled, so they are topped up
 * whenever the app starts or returns to the foreground.
 */
export function EventNotificationBridge() {
  const { calendar } = useCalendarModule();
  const invalidate = useInvalidateCalendar();
  const router = useRouter();

  useNotificationResponses('events', async (response: NotificationResponse) => {
    const { eventId, occurrenceDate } = response.data;
    if (typeof eventId !== 'string' || response.actionId !== 'default') {
      return;
    }
    router.push({
      pathname: '/calendar/event/[id]',
      params:
        typeof occurrenceDate === 'string'
          ? { id: eventId, occurrence: occurrenceDate }
          : { id: eventId },
    });
  });

  const refresh = useCallback(() => {
    calendar
      .refreshReminders()
      .catch(() => undefined)
      .finally(() => void invalidate());
  }, [calendar, invalidate]);
  useOnAppForeground(refresh);
  useEffect(refresh, [refresh]);

  return null;
}
