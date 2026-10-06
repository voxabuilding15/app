import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { BackupScreen } from '@/features/backup/presentation/screens/BackupScreen';
import { DashboardScreen } from '@/features/dashboard';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';
import { SettingsScreen } from '@/features/settings/presentation/screens/SettingsScreen';
import { StatisticsScreen } from '@/features/statistics/presentation/screens/StatisticsScreen';
import { TaskListScreen } from '@/features/tasks';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

describe('with no connection at all', () => {
  const failures: string[] = [];
  const originalFetch = global.fetch;
  const originalRequest = global.XMLHttpRequest;

  beforeEach(() => {
    failures.length = 0;
    global.fetch = (() => {
      failures.push('fetch');
      return Promise.reject(new Error('offline'));
    }) as typeof fetch;
    global.XMLHttpRequest = class {
      constructor() {
        failures.push('XMLHttpRequest');
      }
    } as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    global.XMLHttpRequest = originalRequest;
  });

  it.each([
    ['dashboard', () => <DashboardScreen />],
    ['tasks', () => <TaskListScreen />],
    ['statistics', () => <StatisticsScreen />],
    ['settings', () => <SettingsScreen />],
    ['backup', () => <BackupScreen />],
    ['pomodoro', () => <PomodoroScreen />],
  ] as [string, () => ReactElement][])(
    'the %s screen opens and makes no request',
    async (_name, element) => {
      await renderWithApp(element(), createApp());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(failures).toEqual([]);
    },
  );

  it('exports, backs up and starts a focus session without asking the network for anything', async () => {
    const app = createApp();
    await renderWithApp(<BackupScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Save backup'));
    expect(await screen.findByText('Backup saved on this device')).toBeTruthy();
    expect(await app.pomodoro.timer.start()).toBeTruthy();
    expect(failures).toEqual([]);
  });
});
