import { act, screen, waitFor } from '@testing-library/react-native';

import { DEFAULT_FILTER, defaultSortFor } from '@/features/tasks/domain/filters';
import { emptyDraft } from '@/features/tasks/domain/validation';
import { TaskNotificationBridge } from '@/features/tasks/presentation/TaskNotificationBridge';

import { createApp, renderWithApp, router } from './harness';

const FUTURE = Date.now() + 2 * 86_400_000;

async function seedWithReminder() {
  const app = createApp();
  const saved = await app.tasks.tasks.save(
    {
      ...emptyDraft(),
      title: 'Call the bank',
      due: { at: FUTURE, hasTime: true },
      reminderOffsetMinutes: 0,
    },
    null,
  );
  if (!saved.ok) {
    throw new Error('seed failed');
  }
  return { app, id: saved.id };
}

describe('TaskNotificationBridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('completes the task when the Complete action is used', async () => {
    const { app, id } = await seedWithReminder();
    await renderWithApp(<TaskNotificationBridge />, app);

    await act(async () => app.notifications.emit({ actionId: 'complete', data: { taskId: id } }));
    await waitFor(async () => expect((await app.tasks.tasks.get(id))?.completedAt).not.toBeNull());
    expect(app.notifications.cancelled).toHaveLength(1);
  });

  it('snoozes by rescheduling the notification ten minutes out', async () => {
    const { app, id } = await seedWithReminder();
    await renderWithApp(<TaskNotificationBridge />, app);
    const before = Date.now();

    await act(async () => app.notifications.emit({ actionId: 'snooze', data: { taskId: id } }));
    await waitFor(async () => {
      const task = await app.tasks.tasks.get(id);
      expect(task?.reminderAt).toBeGreaterThanOrEqual(before + 10 * 60_000);
      expect(task?.reminderAt).toBeLessThan(before + 11 * 60_000);
    });
    expect(app.notifications.scheduled).toHaveLength(2);
  });

  it('opens the task when the notification is tapped, including from a cold start', async () => {
    const { app, id } = await seedWithReminder();
    app.notifications.launchResponse = { actionId: 'default', data: { taskId: id } };
    await renderWithApp(<TaskNotificationBridge />, app);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/tasks/[id]', params: { id } }),
    );

    router.push.mockClear();
    await act(async () => app.notifications.emit({ actionId: 'default', data: { taskId: id } }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('ignores notifications that are not about tasks', async () => {
    const { app, id } = await seedWithReminder();
    await renderWithApp(<TaskNotificationBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'complete', data: {} }));
    expect((await app.tasks.tasks.get(id))?.completedAt).toBeNull();
    expect(screen.toJSON()).toBeNull();
  });

  it('clears soft-deleted leftovers from a previous session on launch', async () => {
    const app = createApp();
    const saved = await app.tasks.tasks.save({ ...emptyDraft(), title: 'Ghost' }, null);
    if (!saved.ok) {
      throw new Error('seed failed');
    }
    await app.tasks.tasks.remove([saved.id]);
    await renderWithApp(<TaskNotificationBridge />, app);
    await waitFor(async () => {
      await app.tasks.tasks.undoRemove([saved.id]);
      expect(await app.tasks.tasks.list(DEFAULT_FILTER, defaultSortFor('active'), 10)).toHaveLength(
        0,
      );
    });
  });
});
