import { act } from '@testing-library/react-native';
import { useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import { AchievementsBridge } from '@/features/achievements/presentation/AchievementsBridge';
import { AutoBackupBridge } from '@/features/backup/presentation/AutoBackupBridge';
import { DashboardScreen } from '@/features/dashboard';
import { PomodoroBridge } from '@/features/pomodoro/presentation/PomodoroBridge';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';
import { AppLockGate } from '@/features/settings/presentation/components/AppLockGate';
import { StatisticsScreen } from '@/features/statistics/presentation/screens/StatisticsScreen';
import { TaskNotificationBridge } from '@/features/tasks';

import { createApp, renderWithApp, type TestApp } from './harness';
import { storeRunningTimer } from './pomodoro-seed';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

/** Counts the app-state listeners that are added and not removed again. */
function trackAppState() {
  let active = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((() => {
    active += 1;
    let removed = false;
    return {
      remove: () => {
        if (!removed) {
          removed = true;
          active -= 1;
        }
      },
    };
  }) as never);
  return () => active;
}

const SCREENS: readonly [string, (app: TestApp) => ReactElement][] = [
  ['the Pomodoro bridge with a running timer', () => <PomodoroBridge />],
  ['the Pomodoro screen with a running timer', () => <PomodoroScreen />],
  ['the achievements bridge', () => <AchievementsBridge />],
  ['the automatic backup bridge', () => <AutoBackupBridge />],
  ['the app lock', () => <AppLockGate>{null}</AppLockGate>],
  ['the task notification bridge', () => <TaskNotificationBridge />],
  ['the dashboard', () => <DashboardScreen />],
  ['the statistics screen', () => <StatisticsScreen />],
];

function Leaky() {
  useEffect(() => {
    setInterval(() => undefined, 1_000);
  }, []);
  return null;
}

describe('closing a screen leaves nothing behind', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(SCREENS)('%s', async (_name, build) => {
    const activeListeners = trackAppState();
    const app = createApp();
    storeRunningTimer(app, 5);
    const view = await renderWithApp(build(app), app);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_500);
    });

    view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_000);
    });

    expect(activeListeners()).toBe(0);
    expect(app.notifications.listenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('would notice a timer that keeps running', async () => {
    const view = await renderWithApp(<Leaky />, createApp());
    view.unmount();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });
});
