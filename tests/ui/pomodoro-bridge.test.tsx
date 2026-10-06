import { act, screen, waitFor } from '@testing-library/react-native';
import { Vibration } from 'react-native';

import { PomodoroBridge } from '@/features/pomodoro/presentation/PomodoroBridge';

import { createApp, renderWithApp, router } from './harness';
import { saveSettings, storeRunningTimer } from './pomodoro-seed';

const { __loops: loops } = jest.requireMock('expo-audio') as {
  __loops: {
    source: unknown;
    loop: boolean;
    volume: number;
    play: jest.Mock;
    remove: jest.Mock;
    setActiveForLockScreen: jest.Mock;
    clearLockScreenControls: jest.Mock;
  }[];
};

const timerData = { pomodoro: 'timer' };
const respond = (
  app: ReturnType<typeof createApp>,
  actionId: 'pause' | 'resume' | 'skip' | 'stop' | 'default',
) => act(async () => app.notifications.emit({ actionId, data: timerData }));

describe('PomodoroBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loops.length = 0;
  });

  it('records phases that ended while the app was closed and shows the next one waiting', async () => {
    const app = createApp();
    storeRunningTimer(app, 40);
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(async () => {
      expect(await app.pomodoro.sessions.list({ scope: 'all', search: '' })).toHaveLength(1);
    });
    expect(app.pomodoro.timer.peek()).toMatchObject({ status: 'idle', kind: 'short_break' });
    // Found afterwards, so no buzz.
    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  it('carries on through auto-started phases', async () => {
    const app = createApp();
    saveSettings(app, { autoStartBreaks: true, autoStartFocus: true });
    storeRunningTimer(app, 33, { autoStartBreaks: true, autoStartFocus: true });
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('running'));
    expect(app.pomodoro.timer.peek().kind).toBe('focus');
    expect(await app.pomodoro.sessions.list({ scope: 'all', search: '' })).toHaveLength(2);
  });

  it('applies the buttons on the timer notification', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);

    await respond(app, 'pause');
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('paused'));
    await respond(app, 'resume');
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('running'));
    await respond(app, 'skip');
    await waitFor(() =>
      expect(app.pomodoro.timer.peek()).toMatchObject({ status: 'idle', kind: 'short_break' }),
    );
    expect(await app.pomodoro.sessions.list({ scope: 'focus', search: '' })).toHaveLength(1);
  });

  it('stops from the notification, keeping the time spent', async () => {
    const app = createApp();
    storeRunningTimer(app, 12);
    await renderWithApp(<PomodoroBridge />, app);
    await respond(app, 'stop');
    await waitFor(() =>
      expect(app.pomodoro.timer.peek()).toMatchObject({ status: 'idle', kind: 'focus' }),
    );
    const [entry] = await app.pomodoro.sessions.list({ scope: 'all', search: '' });
    expect(entry).toMatchObject({ outcome: 'stopped' });
  });

  it('applies a button pressed while the app was closed', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    app.notifications.launchResponse = { actionId: 'pause', data: timerData };
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('paused'));
  });

  it('opens the timer when the notification is tapped', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await respond(app, 'default');
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/pomodoro'));
  });

  it('ignores notifications that belong to other features', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await act(async () => app.notifications.emit({ actionId: 'skip', data: { habitId: 'x' } }));
    expect(app.pomodoro.timer.peek().status).toBe('running');
  });

  it('moves on by itself when a running phase reaches its end', async () => {
    const app = createApp();
    storeRunningTimer(app, 25, {}, { endsAt: Date.now() + 100 });
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('idle'), { timeout: 2000 });
    expect(await app.pomodoro.sessions.list({ scope: 'all', search: '' })).toHaveLength(1);
    expect(Vibration.vibrate).toHaveBeenCalledTimes(1);
  });

  it('does not buzz when vibration is off', async () => {
    const app = createApp();
    saveSettings(app, { vibrate: false });
    storeRunningTimer(app, 25, { vibrate: false }, { endsAt: Date.now() + 100 });
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(app.pomodoro.timer.peek().status).toBe('idle'), { timeout: 2000 });
    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });
});

describe('focus sounds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loops.length = 0;
  });

  it('loops the chosen ambient sound while focusing and registers it for the lock screen', async () => {
    const app = createApp();
    saveSettings(app, { ambientSound: 'rain' });
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(loops).toHaveLength(1));
    const [ambient] = loops;
    expect(ambient).toMatchObject({ loop: true });
    expect(ambient?.play).toHaveBeenCalled();
    expect(ambient?.setActiveForLockScreen).toHaveBeenCalledWith(true, {
      title: 'Rain',
      artist: 'FocusFlow',
    });
  });

  it('stops the sound when the timer is paused', async () => {
    const app = createApp();
    saveSettings(app, { ambientSound: 'forest' });
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(loops).toHaveLength(1));
    await respond(app, 'pause');
    await waitFor(() => expect(loops[0]?.remove).toHaveBeenCalled());
    expect(loops[0]?.clearLockScreenControls).toHaveBeenCalled();
  });

  it('does not tick unless it is turned on', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await act(async () => undefined);
    expect(loops).toHaveLength(0);
  });

  it('ticks while focusing when the tick sound is on, without taking over the lock screen', async () => {
    const app = createApp();
    saveSettings(app, { tickSound: true });
    storeRunningTimer(app, 5);
    await renderWithApp(<PomodoroBridge />, app);
    await waitFor(() => expect(loops).toHaveLength(1));
    expect(loops[0]).toMatchObject({ loop: true });
    expect(loops[0]?.play).toHaveBeenCalled();
    expect(loops[0]?.setActiveForLockScreen).not.toHaveBeenCalled();
  });

  it('stays silent during breaks', async () => {
    const app = createApp();
    saveSettings(app, { ambientSound: 'white-noise', tickSound: true });
    storeRunningTimer(app, 2, {}, { kind: 'short_break' });
    await renderWithApp(<PomodoroBridge />, app);
    await act(async () => undefined);
    expect(loops).toHaveLength(0);
    expect(screen.toJSON()).toBeNull();
  });
});
