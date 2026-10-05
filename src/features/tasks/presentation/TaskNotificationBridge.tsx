import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import type { NotificationResponse } from '@/core';
import { useNotificationResponses, useOnAppForeground } from '@/hooks';

import { useTasksModule } from './module';
import { useInvalidateTasks } from './queries';

/**
 * Headless component that keeps tasks in sync with the outside world: it handles taps and action
 * buttons on task notifications, clears undo leftovers on launch, and refreshes day-relative data
 * (today's progress, overdue) when the app returns to the foreground.
 */
export function TaskNotificationBridge() {
  const { tasks } = useTasksModule();
  const invalidate = useInvalidateTasks();
  const router = useRouter();

  useNotificationResponses('tasks', async (response: NotificationResponse) => {
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
  });

  useOnAppForeground(() => void invalidate());

  useEffect(() => {
    void tasks.purgeLeftovers();
  }, [tasks]);

  return null;
}
