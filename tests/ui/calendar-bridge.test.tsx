import { act, waitFor } from '@testing-library/react-native';

import { toDateKey } from '@/core';
import { EventNotificationBridge } from '@/features/calendar/presentation/EventNotificationBridge';

import { createApp, renderWithApp, router } from './harness';

describe('EventNotificationBridge', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the occurrence when a reminder is tapped', async () => {
    const app = createApp();
    await renderWithApp(<EventNotificationBridge />, app);
    const occurrenceDate = toDateKey(Date.now());
    await act(async () =>
      app.notifications.emit({ actionId: 'default', data: { eventId: 'e1', occurrenceDate } }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/calendar/event/[id]',
      params: { id: 'e1', occurrence: occurrenceDate },
    });
  });

  it('opens an event tapped from a cold start', async () => {
    const app = createApp();
    app.notifications.launchResponse = { actionId: 'default', data: { eventId: 'e2' } };
    await renderWithApp(<EventNotificationBridge />, app);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/calendar/event/[id]',
        params: { id: 'e2' },
      }),
    );
  });

  it('ignores notifications for other features and non-tap actions', async () => {
    const app = createApp();
    await renderWithApp(<EventNotificationBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'default', data: { taskId: 't1' } }));
    await act(async () => app.notifications.emit({ actionId: 'dismiss', data: { eventId: 'e1' } }));
    expect(router.push).not.toHaveBeenCalled();
  });

  it('refreshes upcoming reminders when it mounts', async () => {
    const app = createApp();
    const refresh = jest.spyOn(app.calendar, 'refreshReminders');
    await renderWithApp(<EventNotificationBridge />, app);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
