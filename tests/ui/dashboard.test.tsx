import { fireEvent, screen } from '@testing-library/react-native';

import { DashboardScreen } from '@/features/dashboard';

import { createSeeder } from '../support/seed';

import { createApp, renderWithApp, router } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

describe('DashboardScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('greets, shows the level and the quick actions', async () => {
    await renderWithApp(<DashboardScreen />);
    expect(await screen.findByText(/^Good (morning|afternoon|evening)$/)).toBeTruthy();
    expect(await screen.findByLabelText(/^Level 1, Beginner/)).toBeTruthy();
    for (const label of ['Add task', 'Log habit', 'Add expense', 'Start focus']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('shows today’s figures taken from the whole app', async () => {
    const app = createApp();
    const seed = createSeeder(app.container.db, () => Date.now());
    const start = new Date();
    start.setHours(0, 0, 1, 0);
    const earlier = start.getTime();
    seed.addTask('Done', { createdAt: earlier, dueAt: earlier, completedAt: earlier + 1000 });
    seed.addTask('Late', { createdAt: earlier, dueAt: earlier });
    seed.addTransaction('expense', 4_250, earlier);
    await seed.addFocus(earlier + 5_000, 25);
    await renderWithApp(<DashboardScreen />, app);

    expect(await screen.findByLabelText('Tasks: 1 done. 1 overdue')).toBeTruthy();
    expect(screen.getByLabelText('Focus: 25m. 1 session')).toBeTruthy();
    expect(screen.getByLabelText(/^Spending: \$42\.50\. No income today/)).toBeTruthy();
    expect(screen.getByLabelText(/^Calendar: 0 events/)).toBeTruthy();
    expect(screen.getByLabelText(/^Productivity score: \d+\. See all statistics/)).toBeTruthy();
  });

  it('opens the part of the app a card comes from', async () => {
    await renderWithApp(<DashboardScreen />);
    for (const [label, href] of [
      [/^Tasks: /, '/tasks'],
      [/^Habits: /, '/habits'],
      [/^Focus: /, '/pomodoro'],
      [/^Spending: /, '/finance'],
      [/^Calendar: /, '/calendar'],
      [/^Productivity score: /, '/statistics'],
    ] as const) {
      await fireEvent.press(await screen.findByLabelText(label));
      expect(router.navigate).toHaveBeenLastCalledWith(href);
    }
    await fireEvent.press(screen.getByLabelText(/^Level \d+/));
    expect(router.navigate).toHaveBeenLastCalledWith('/achievements');
  });
});
