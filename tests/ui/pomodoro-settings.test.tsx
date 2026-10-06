import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { DEFAULT_SETTINGS } from '@/features/pomodoro/domain/settings';
import { SettingsScreen } from '@/features/pomodoro/presentation/screens/SettingsScreen';

import { createApp, renderWithApp, router } from './harness';
import { storeRunningTimer } from './pomodoro-seed';

describe('SettingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('changes the durations as you step them, and keeps them', async () => {
    const app = createApp();
    await renderWithApp(<SettingsScreen />, app);
    const stepper = await screen.findByLabelText('Focus minutes');
    expect(stepper.props.accessibilityValue).toMatchObject({ now: 25 });

    await fireEvent.press(screen.getByLabelText('Increase Focus minutes'));
    await waitFor(() => expect(app.pomodoro.timer.settings().focusMinutes).toBe(26));
    await fireEvent.press(screen.getByLabelText('Decrease Short break minutes'));
    await waitFor(() => expect(app.pomodoro.timer.settings().shortBreakMinutes).toBe(4));
    expect(screen.getByLabelText('Focus minutes').props.accessibilityValue).toMatchObject({
      now: 26,
    });
  });

  it('turns automation, vibration, the tick and the exact alarm on and off', async () => {
    const app = createApp();
    await renderWithApp(<SettingsScreen />, app);
    const flip = async (title: string) => {
      await fireEvent(await screen.findByLabelText(title), 'valueChange', true);
    };
    await flip('Start breaks automatically');
    await flip('Start focus automatically');
    await flip('Tick sound');
    await flip('Exact alarm');
    await fireEvent(screen.getByLabelText('Vibrate'), 'valueChange', false);
    await waitFor(() =>
      expect(app.pomodoro.timer.settings()).toMatchObject({
        autoStartBreaks: true,
        autoStartFocus: true,
        tickSound: true,
        exactAlarm: true,
        vibrate: false,
      }),
    );
  });

  it('picks an ambient sound', async () => {
    const app = createApp();
    await renderWithApp(<SettingsScreen />, app);
    for (const [label, value] of [
      ['Rain', 'rain'],
      ['Forest', 'forest'],
      ['Coffee shop', 'coffee-shop'],
      ['White noise', 'white-noise'],
      ['Off', 'none'],
    ] as const) {
      await fireEvent.press(await screen.findByLabelText(label));
      await waitFor(() => expect(app.pomodoro.timer.settings().ambientSound).toBe(value));
    }
  });

  it('sets goals, rejecting numbers that are too large', async () => {
    const app = createApp();
    await renderWithApp(<SettingsScreen />, app);
    const daily = await screen.findByLabelText('Daily goal (minutes of focus)');
    await fireEvent.changeText(daily, '120');
    await waitFor(() => expect(app.pomodoro.timer.settings().dailyGoalMinutes).toBe(120));
    await fireEvent.changeText(daily, '9999');
    expect(await screen.findByText('Choose a whole number from 0 to 720')).toBeTruthy();
    expect(app.pomodoro.timer.settings().dailyGoalMinutes).toBe(120);
    await fireEvent.changeText(daily, '0');
    await waitFor(() => expect(app.pomodoro.timer.settings().dailyGoalMinutes).toBe(0));
    await waitFor(() => expect(screen.queryByText(/Choose a whole number/)).toBeNull());
  });

  it('refreshes the timer notification when a running timer is affected', async () => {
    const app = createApp();
    storeRunningTimer(app, 5);
    await renderWithApp(<SettingsScreen />, app);
    await fireEvent(
      await screen.findByLabelText('Start breaks automatically'),
      'valueChange',
      true,
    );
    await waitFor(() => expect(app.notifications.presented.length).toBeGreaterThan(0));
    expect(app.pomodoro.timer.settings()).toMatchObject({
      ...DEFAULT_SETTINGS,
      autoStartBreaks: true,
    });
  });

  it('offers to turn notifications on when they are off', async () => {
    const app = createApp();
    app.notifications.getPermissionState = async () => 'undetermined';
    const requested = jest.spyOn(app.notifications, 'requestPermission');
    await renderWithApp(<SettingsScreen />, app);
    expect(await screen.findByText(/Notifications are off/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Allow notifications'));
    expect(requested).toHaveBeenCalled();
  });

  it('opens the tag manager', async () => {
    await renderWithApp(<SettingsScreen />);
    await fireEvent.press(await screen.findByLabelText('Session tags'));
    expect(router.push).toHaveBeenCalledWith('/pomodoro/tags');
  });
});
