import { act, waitFor } from '@testing-library/react-native';

import { toDateKey } from '@/core';
import { emptyHabitDraft } from '@/features/habits/domain/validation';
import { HabitNotificationBridge } from '@/features/habits/presentation/HabitNotificationBridge';
import { TaskNotificationBridge } from '@/features/tasks/presentation/TaskNotificationBridge';

import { createApp, renderWithApp, router } from './harness';

async function seeded() {
  const app = createApp();
  const result = await app.habits.save(
    { ...emptyHabitDraft('menu-book', '#2563EB'), name: 'Read', goalCount: 3 },
    null,
  );
  if (!result.ok) {
    throw new Error('seed failed');
  }
  return { app, id: result.id };
}

describe('HabitNotificationBridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs a completion from the Done action', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<HabitNotificationBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'complete', data: { habitId: id } }));
    await waitFor(async () => expect((await app.habits.detail(id))?.summary.todayCount).toBe(1));
  });

  it('skips today from the Skip action', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<HabitNotificationBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'skip', data: { habitId: id } }));
    await waitFor(async () =>
      expect((await app.habits.detail(id))?.summary.skippedToday).toBe(true),
    );
  });

  it('opens the habit when tapped, including from a cold start', async () => {
    const { app, id } = await seeded();
    app.notifications.launchResponse = { actionId: 'default', data: { habitId: id } };
    await renderWithApp(<HabitNotificationBridge />, app);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({ pathname: '/habits/[id]', params: { id } }),
    );
  });

  it('ignores notifications meant for other features', async () => {
    const { app, id } = await seeded();
    await renderWithApp(<HabitNotificationBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'complete', data: { taskId: 'x' } }));
    expect((await app.habits.detail(id))?.summary.todayCount).toBe(0);
    expect(toDateKey(Date.now())).toBeTruthy();
  });

  it('delivers a launch notification to the right feature when several are listening', async () => {
    const { app, id } = await seeded();
    app.notifications.launchResponse = { actionId: 'default', data: { habitId: id } };
    await renderWithApp(
      <>
        <TaskNotificationBridge />
        <HabitNotificationBridge />
      </>,
      app,
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/habits/[id]', params: { id } });
  });
});
