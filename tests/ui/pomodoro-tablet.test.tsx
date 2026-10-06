import { fireEvent, screen } from '@testing-library/react-native';

import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';
import { SettingsScreen } from '@/features/pomodoro/presentation/screens/SettingsScreen';

import { createApp, renderWithApp } from './harness';
import { addSession } from './pomodoro-seed';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1100, height: 800, scale: 2, fontScale: 1 }),
}));

describe('pomodoro tablet layout (1100 x 800)', () => {
  it('keeps the timer beside the statistics and history instead of behind a tab', async () => {
    const app = createApp();
    await addSession(app, { note: 'Tablet note', minutesAgo: 20 });
    await renderWithApp(<PomodoroScreen />, app);

    expect(await screen.findByText('25:00')).toBeTruthy();
    expect(screen.getByLabelText('Start focus')).toBeTruthy();
    expect(screen.getByLabelText('Note')).toBeTruthy();
    // Statistics are shown next to it, and there is no "Timer" tab to switch to.
    expect(await screen.findByLabelText(/^Focus minutes per day\./)).toBeTruthy();
    expect(screen.queryByLabelText('Timer')).toBeNull();

    await fireEvent.press(screen.getByLabelText('History'));
    expect(await screen.findByText('Tablet note')).toBeTruthy();
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('still runs the timer', async () => {
    await renderWithApp(<PomodoroScreen />);
    await fireEvent.press(await screen.findByLabelText('Start focus'));
    expect(await screen.findByLabelText('Pause')).toBeTruthy();
  });

  it('shows every settings section', async () => {
    await renderWithApp(<SettingsScreen />);
    for (const section of ['Durations', 'Automation', 'Sounds and alerts', 'Goals', 'Tags']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
  });
});
