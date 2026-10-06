import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { emptyDraft } from '@/features/tasks/domain/validation';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';

import { createApp, renderWithApp, router } from './harness';
import { addSession, saveSettings, storeRunningTimer } from './pomodoro-seed';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

const press = (label: string | RegExp) =>
  screen.findByLabelText(label).then((node) => fireEvent.press(node));

describe('PomodoroScreen timer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts idle on a full focus session with the three phases to choose from', async () => {
    await renderWithApp(<PomodoroScreen />);
    expect(await screen.findByText('25:00')).toBeTruthy();
    expect(screen.getByText('Session 1 of 4')).toBeTruthy();
    expect(screen.getByLabelText('Focus, 25 minutes left')).toBeTruthy();
    expect(screen.getByLabelText('Short break')).toBeTruthy();
    expect(screen.getByLabelText('Long break')).toBeTruthy();
    expect(screen.getByLabelText('Start focus')).toBeTruthy();
  });

  it('shows the length of the phase you pick, using the custom durations', async () => {
    const app = createApp();
    saveSettings(app, { focusMinutes: 50, shortBreakMinutes: 7, longBreakMinutes: 20 });
    await renderWithApp(<PomodoroScreen />, app);
    expect(await screen.findByText('50:00')).toBeTruthy();
    await press('Short break');
    expect(await screen.findByText('7:00')).toBeTruthy();
    expect(screen.getByLabelText('Start break')).toBeTruthy();
    await press('Long break');
    expect(await screen.findByText('20:00')).toBeTruthy();
  });

  it('starts, pauses, resumes and stops, with the notification following along', async () => {
    const app = await (async () => createApp())();
    await renderWithApp(<PomodoroScreen />, app);
    await press('Start focus');

    expect(await screen.findByLabelText('Pause')).toBeTruthy();
    expect(screen.queryByLabelText('Start focus')).toBeNull();
    await waitFor(() =>
      expect(app.notifications.presented.at(-1)).toMatchObject({
        title: 'Focus in progress',
        categoryId: 'timer-running',
      }),
    );
    expect(app.notifications.scheduled).toContain('Focus finished');

    await press('Pause');
    expect(await screen.findByLabelText('Resume')).toBeTruthy();
    expect(screen.getByText(/Paused/)).toBeTruthy();
    await waitFor(() =>
      expect(app.notifications.presented.at(-1)).toMatchObject({ categoryId: 'timer-paused' }),
    );

    await press('Resume');
    expect(await screen.findByLabelText('Pause')).toBeTruthy();

    await press('Stop');
    expect(await screen.findByLabelText('Start focus')).toBeTruthy();
    expect(screen.getByText('25:00')).toBeTruthy();
    // Stopped within a minute: not worth keeping.
    expect(await app.pomodoro.sessions.list({ scope: 'all', search: '' })).toHaveLength(0);
  });

  it('skips a running focus session on to its break, saving what was done', async () => {
    const app = createApp();
    storeRunningTimer(app, 10);
    await renderWithApp(<PomodoroScreen />, app);
    await press('Skip');
    expect(await screen.findByLabelText('Start break')).toBeTruthy();
    expect(screen.getByText('5:00')).toBeTruthy();
    const [entry] = await app.pomodoro.sessions.list({ scope: 'all', search: '' });
    expect(entry).toMatchObject({ kind: 'focus', outcome: 'skipped' });
    expect(entry?.durationSeconds).toBeGreaterThanOrEqual(599);
  });

  it('counts down from the stored end time', async () => {
    const app = createApp();
    storeRunningTimer(app, 10);
    await renderWithApp(<PomodoroScreen />, app);
    expect(
      await screen.findByLabelText(/^Focus, (15 minutes|14 minutes (59|58) seconds) left$/),
    ).toBeTruthy();
  });

  it('tells you when notifications are off', async () => {
    const app = createApp();
    app.notifications.getPermissionState = async () => 'denied';
    await renderWithApp(<PomodoroScreen />, app);
    await press('Start focus');
    expect(await screen.findByText(/Notifications are off/)).toBeTruthy();
    expect(await screen.findByLabelText('Pause')).toBeTruthy();
  });

  it('shows today against the daily goal', async () => {
    const app = createApp();
    saveSettings(app, { dailyGoalMinutes: 100 });
    await addSession(app, { durationSeconds: 3000, minutesAgo: 1 });
    await renderWithApp(<PomodoroScreen />, app);
    expect(await screen.findByText('Today: 50m of 1h 40m')).toBeTruthy();
    expect(screen.getByLabelText('Daily goal 50 percent')).toBeTruthy();
  });

  it('opens the settings', async () => {
    await renderWithApp(<PomodoroScreen />);
    await press('Pomodoro settings');
    expect(router.push).toHaveBeenCalledWith('/pomodoro/settings');
  });
});

describe('what a session is about', () => {
  beforeEach(() => jest.clearAllMocks());

  it('links a task, a habit and tags, which are saved with the finished session', async () => {
    const app = createApp();
    const taskId = await app.tasks.tasks.save(
      {
        ...emptyDraft(),
        title: 'Write report',
      },
      null,
    );
    expect(taskId.ok).toBe(true);
    const tagId = await app.pomodoro.tags.save({ id: null, name: 'Writing', color: '#16A34A' });
    expect(tagId.ok).toBe(true);
    app.container.db.runSync(
      `INSERT INTO habits (id, name, icon, color, goal_period, created_at)
       VALUES ('h1', 'Read', 'star', '#000000', 'daily', 1)`,
    );
    storeRunningTimer(app, 10);

    await renderWithApp(<PomodoroScreen />, app);
    await press('Link a habit');
    await fireEvent.press(await screen.findByText('Read'));
    await waitFor(() => expect(screen.getByLabelText(/^Habit: Read/)).toBeTruthy());
    await press('Link a task');
    await fireEvent.press(await screen.findByText('Write report'));
    await waitFor(() => expect(screen.getByLabelText(/^Task: Write report/)).toBeTruthy());
    await fireEvent.press(await screen.findByLabelText('Writing'));

    await waitFor(() => expect(app.pomodoro.timer.peek().links.tagIds).toHaveLength(1));
    expect(app.pomodoro.timer.peek().links.taskId).toBe(taskId.ok ? taskId.id : null);
    // The phase runs out while the app is closed.
    const running = JSON.parse(app.container.storage.getString('pomodoro.timer') ?? '{}');
    app.container.storage.setString(
      'pomodoro.timer',
      JSON.stringify({ ...running, endsAt: Date.now() - 1000 }),
    );
    await act(async () => {
      await app.pomodoro.timer.sync();
    });
    const [entry] = await app.pomodoro.sessions.list({ scope: 'all', search: '' });
    expect(entry?.task?.title).toBe('Write report');
    expect(entry?.habit?.title).toBe('Read');
    expect(entry?.tags.map((tag) => tag.name)).toEqual(['Writing']);
  });

  it('keeps the note typed for the session once the field is left', async () => {
    const app = createApp();
    await renderWithApp(<PomodoroScreen />, app);
    const note = await screen.findByLabelText('Note');
    await fireEvent.changeText(note, 'Chapter three');
    await fireEvent(note, 'blur');
    await waitFor(() => expect(app.pomodoro.timer.peek().links.note).toBe('Chapter three'));
  });

  it('opens the tag manager', async () => {
    await renderWithApp(<PomodoroScreen />);
    await press('Add tags');
    expect(router.push).toHaveBeenCalledWith('/pomodoro/tags');
  });
});
