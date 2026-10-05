import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useContainer, type NotificationResponse } from '@/core';

import { useTasksModule } from './module';
import { useInvalidateTasks } from './queries';

/**
 * Headless component that keeps tasks in sync with the outside world: it handles taps and action
 * buttons on task notifications, clears undo leftovers on launch, and refreshes day-relative data
 * (today's progress, overdue) when the app returns to the foreground.
 */
export function TaskNotificationBridge() {
  const { notifications } = useContainer();
  const { tasks } = useTasksModule();
  const invalidate = useInvalidateTasks();
  const router = useRouter();

  useEffect(() => {
    const handle = async (response: NotificationResponse) => {
      const taskId = response.data.taskId;
      if (typeof taskId !== 'string') {
        return;
      }
      try {
        if (response.actionId === 'complete') {
          await tasks.setCompleted(taskId, true);
        } else if (response.actionId === 'snooze') {
          await tasks.snooze(taskId);
        } else if (response.actionId === 'default') {
          router.push({ pathname: '/tasks/[id]', params: { id: taskId } });
        }
      } finally {
        await invalidate();
      }
    };

    const unsubscribe = notifications.onResponse((response) => void handle(response));
    const initial = notifications.consumeInitialResponse();
    if (initial !== null) {
      void handle(initial);
    }
    void tasks.purgeLeftovers();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void invalidate();
      }
    });

    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [notifications, tasks, invalidate, router]);

  return null;
}
