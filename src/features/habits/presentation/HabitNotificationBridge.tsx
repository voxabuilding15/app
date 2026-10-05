import { useRouter } from 'expo-router';

import { toDateKey, type NotificationResponse } from '@/core';
import { useNotificationResponses, useOnAppForeground } from '@/hooks';

import { useHabitsModule } from './module';
import { useInvalidateHabits } from './queries';

/**
 * Headless component that handles taps and the Done / Skip buttons on habit reminders, and
 * refreshes day-relative progress when the app returns to the foreground.
 */
export function HabitNotificationBridge() {
  const { habits } = useHabitsModule();
  const invalidate = useInvalidateHabits();
  const router = useRouter();

  useNotificationResponses('habits', async (response: NotificationResponse) => {
    const habitId = response.data.habitId;
    if (typeof habitId !== 'string') {
      return;
    }
    const today = toDateKey(Date.now());
    try {
      if (response.actionId === 'complete') {
        await habits.adjust(habitId, today, 1);
      } else if (response.actionId === 'skip') {
        await habits.skip(habitId, today, true);
      } else if (response.actionId === 'default') {
        router.push({ pathname: '/habits/[id]', params: { id: habitId } });
      }
    } finally {
      await invalidate();
    }
  });

  useOnAppForeground(() => void invalidate());

  return null;
}
