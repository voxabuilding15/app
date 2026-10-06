import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { StatisticsScreen } from '@/features/statistics/presentation/screens/StatisticsScreen';

import { createApp, renderWithApp } from './harness';
import { createSeeder } from '../support/seed';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

/** Waits for a running export to finish, so its last state update lands inside the test. */
const idle = () =>
  waitFor(() =>
    expect(screen.getByLabelText('Export as CSV').props.accessibilityState.disabled).toBe(false),
  );

function seeded() {
  const app = createApp();
  const seed = createSeeder(app.container.db, () => Date.now());
  const start = new Date();
  start.setHours(0, 0, 1, 0);
  const earlier = start.getTime();
  seed.addTask('Done', { createdAt: earlier, dueAt: earlier, completedAt: earlier + 5_000 });
  seed.addTask('Late', { createdAt: earlier, dueAt: earlier });
  seed.addHabit('Read', '2000-01-01', []);
  seed.addTransaction('income', 100_000, earlier);
  seed.addTransaction('expense', 25_000, earlier + 1_000);
  seed.addNote('Idea', earlier);
  return { app, seed, earlier };
}

describe('StatisticsScreen', () => {
  it('shows the scores, the trends and a card for every area of the app', async () => {
    const { app, seed, earlier } = seeded();
    await seed.addFocus(earlier + 10_000, 30, { deepFocus: 80 });
    await renderWithApp(<StatisticsScreen />, app);

    expect(await screen.findByLabelText(/^Task completion rate: 50%/)).toBeTruthy();
    expect(screen.getByLabelText(/^Focus score: 80/)).toBeTruthy();
    expect(screen.getByLabelText(/^Habit consistency: /)).toBeTruthy();
    expect(screen.getByLabelText(/^Productivity score: \d+ out of 100/)).toBeTruthy();
    for (const title of ['Tasks', 'Habits', 'Focus', 'Calendar', 'Finance', 'Notes']) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
    expect(screen.getByLabelText(/^Spending: \$250\.00/)).toBeTruthy();
    expect(screen.getByLabelText(/^Income: \$1,000\.00/)).toBeTruthy();
  });

  it('is calm about an empty app', async () => {
    await renderWithApp(<StatisticsScreen />);
    expect(await screen.findByLabelText(/^Productivity score: no data yet/)).toBeTruthy();
    expect(screen.getByLabelText(/^Focus score: no data yet/)).toBeTruthy();
  });

  it('moves between periods and back to today', async () => {
    const { app } = seeded();
    await renderWithApp(<StatisticsScreen />, app);
    await screen.findByLabelText(/^Task completion rate/);
    const header = () => screen.getAllByRole('header').map((node) => node.props.children);

    expect(screen.getByLabelText('Next week').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByLabelText('Back to today')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Previous week'));
    expect(await screen.findByLabelText('Back to today')).toBeTruthy();
    expect(screen.getByLabelText('Next week').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByLabelText('Back to today'));
    await waitFor(() => expect(screen.queryByLabelText('Back to today')).toBeNull());

    await fireEvent.press(screen.getByLabelText('Year'));
    expect(await screen.findByLabelText('Previous year')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Day'));
    expect(await screen.findByLabelText('Next day')).toBeTruthy();
    expect(header().length).toBeGreaterThan(0);
  });

  it('switches the chart metric and reads a tapped bar', async () => {
    const { app, seed, earlier } = seeded();
    await seed.addFocus(earlier + 20_000, 40);
    await renderWithApp(<StatisticsScreen />, app);
    await screen.findByLabelText(/^Task completion rate/);
    expect(screen.getByText(/^Total: 40m/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(/: 40m$/));
    expect(await screen.findByText(/: 40m$/)).toBeTruthy();
    expect(screen.queryByText(/^Total:/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('Spending'));
    expect(await screen.findByText(/^Total: \$250\.00/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tasks'));
    expect(await screen.findByText('Total: 1 task completed')).toBeTruthy();
  });

  it('hides the habit metric for a single day, where it cannot be told apart by hour', async () => {
    await renderWithApp(<StatisticsScreen />);
    await screen.findByLabelText(/^Productivity score/);
    expect(screen.getAllByLabelText('Habits').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Day'));
    await waitFor(() => expect(screen.getByLabelText('Next day')).toBeTruthy());
    expect(screen.queryByLabelText('Habits')).toBeNull();
  });

  it('exports CSV and PDF and offers them to other apps', async () => {
    const { app } = seeded();
    await renderWithApp(<StatisticsScreen />, app);
    await screen.findByLabelText(/^Task completion rate/);

    await fireEvent.press(screen.getByLabelText('Export as CSV'));
    expect(await screen.findByText('Report exported')).toBeTruthy();
    expect(app.deviceFiles.shared.at(-1)?.mimeType).toBe('text/csv');
    const [csv] = await app.deviceFiles.list('cache', 'exports');
    expect(await app.deviceFiles.readText('cache', csv!.path)).toContain(
      'Task completion rate,50,',
    );

    await fireEvent.press(screen.getByLabelText('Export as PDF'));
    await waitFor(() => expect(app.deviceFiles.shared.at(-1)?.mimeType).toBe('application/pdf'));
    await idle();
  });

  it('says so when no app can open the export, and when exporting fails', async () => {
    const { app } = seeded();
    app.deviceFiles.canShare = false;
    await renderWithApp(<StatisticsScreen />, app);
    await screen.findByLabelText(/^Task completion rate/);
    await fireEvent.press(screen.getByLabelText('Export as CSV'));
    expect(
      await screen.findByText('Report saved, but no app can open it on this device'),
    ).toBeTruthy();

    jest.spyOn(app.deviceFiles, 'writeText').mockRejectedValue(new Error('disk full'));
    await fireEvent.press(screen.getByLabelText('Export as CSV'));
    expect(await screen.findByText("Couldn't export the report. Try again.")).toBeTruthy();
    await idle();
  });
});
