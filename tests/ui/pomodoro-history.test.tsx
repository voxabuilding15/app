import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { SessionDetailsScreen } from '@/features/pomodoro/presentation/screens/SessionDetailsScreen';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';
import { TagsScreen } from '@/features/pomodoro/presentation/screens/TagsScreen';

import { createApp, renderWithApp, router } from './harness';
import { addSession, saveSettings } from './pomodoro-seed';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

const open = async (section: 'History' | 'Stats') =>
  fireEvent.press(await screen.findByLabelText(section));

describe('history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('explains an empty history', async () => {
    await renderWithApp(<PomodoroScreen />);
    await open('History');
    expect(await screen.findByText('No sessions yet')).toBeTruthy();
  });

  it('lists focus sessions with their score, notes, links and tags, newest first', async () => {
    const app = createApp();
    const tag = await app.pomodoro.tags.save({ id: null, name: 'Study', color: '#16A34A' });
    await addSession(app, {
      minutesAgo: 300,
      durationSeconds: 1500,
      note: 'Older note',
    });
    await addSession(app, {
      minutesAgo: 30,
      durationSeconds: 900,
      outcome: 'stopped',
      deepFocus: 60,
      pauses: 2,
      note: 'Read chapter 4',
      tagIds: tag.ok ? [tag.id] : [],
    });
    await addSession(app, {
      minutesAgo: 20,
      kind: 'short_break',
      durationSeconds: 300,
      deepFocus: null,
    });
    await renderWithApp(<PomodoroScreen />, app);
    await open('History');

    const newest = await screen.findByLabelText(/^Focus, 15m, stopped early/);
    expect(newest).toBeTruthy();
    expect(screen.getByText('Read chapter 4')).toBeTruthy();
    expect(screen.getByText('Study')).toBeTruthy();
    expect(screen.getByText(/2 pauses/)).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    const labels = screen
      .getAllByLabelText(/^Focus, /)
      .map((node) => String(node.props.accessibilityLabel).split('.')[0]);
    expect(labels).toEqual(['Focus, 15m, stopped early', 'Focus, 25m, completed']);
    // Breaks are in their own tab.
    expect(screen.queryByLabelText(/^Short break/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Breaks'));
    expect(await screen.findByLabelText('Short break, 5m, completed')).toBeTruthy();
  });

  it('searches the notes of past sessions', async () => {
    const app = createApp();
    await addSession(app, { note: 'Budget review', minutesAgo: 50 });
    await addSession(app, { note: 'Garden plan', minutesAgo: 40 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('History');
    await screen.findByText('Garden plan');
    await fireEvent.changeText(screen.getByLabelText('Search history'), 'budget');
    await waitFor(() => expect(screen.queryByText('Garden plan')).toBeNull());
    expect(screen.getByText('Budget review')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search history'), 'zzz');
    expect(await screen.findByText('No matching sessions')).toBeTruthy();
  });

  it('deletes a session and puts it back with Undo', async () => {
    const app = createApp();
    await addSession(app, { note: 'Keep me', minutesAgo: 50 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('History');
    await screen.findByText('Keep me');

    await fireEvent.press(screen.getByLabelText(/^Delete Focus/));
    await waitFor(() => expect(screen.queryByText('Keep me')).toBeNull());
    expect(await screen.findByText('Session deleted')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByText('Keep me')).toBeTruthy();
  });

  it('opens the details of a focus session', async () => {
    const app = createApp();
    const id = await addSession(app, { note: 'Open me', minutesAgo: 50 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('History');
    await fireEvent.press(await screen.findByLabelText(/Edit details/));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/pomodoro/session/[id]',
      params: { id },
    });
  });
});

describe('session details', () => {
  beforeEach(() => jest.clearAllMocks());

  it('edits the note, task and tags of a saved session', async () => {
    const app = createApp();
    const tag = await app.pomodoro.tags.save({ id: null, name: 'Admin', color: '#16A34A' });
    app.container.db.runSync(
      `INSERT INTO habits (id, name, icon, color, goal_period, created_at) VALUES ('h1', 'Stretch', 'star', '#000000', 'daily', 1)`,
    );
    const id = await addSession(app, { note: 'First draft' });
    await renderWithApp(<SessionDetailsScreen id={id} />, app);

    const note = await screen.findByDisplayValue('First draft');
    expect(screen.getByLabelText('Save').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await fireEvent.changeText(note, 'Final version');
    await fireEvent.press(screen.getByLabelText('Admin'));
    await fireEvent.press(screen.getByLabelText('Link a habit'));
    await fireEvent.press(await screen.findByText('Stretch'));
    await fireEvent.press(screen.getByLabelText('Save'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const saved = await app.pomodoro.sessions.get(id);
    expect(saved).toMatchObject({ note: 'Final version', habitId: 'h1' });
    expect(saved?.tagIds).toEqual([tag.ok ? tag.id : '']);
  });

  it('says when the session is gone', async () => {
    await renderWithApp(<SessionDetailsScreen id="missing" />);
    expect(await screen.findByText('Session not found')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Back to history'));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('tags', () => {
  it('manages session tags like other tags', async () => {
    const app = createApp();
    await app.pomodoro.tags.save({ id: null, name: 'Writing', color: '#16A34A' });
    await renderWithApp(<TagsScreen />, app);
    expect(await screen.findByText('Writing')).toBeTruthy();
  });
});

describe('statistics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invites you to focus when there is nothing to show', async () => {
    await renderWithApp(<PomodoroScreen />);
    await open('Stats');
    expect(await screen.findByText('No focus time yet')).toBeTruthy();
  });

  it('shows goals, streak, deep focus and where the time went', async () => {
    const app = createApp();
    saveSettings(app, { dailyGoalMinutes: 100, weeklyGoalMinutes: 0, monthlyGoalMinutes: 2000 });
    app.container.db.runSync(
      `INSERT INTO tasks (id, title, created_at, updated_at) VALUES ('t1', 'Write report', 1, 1)`,
    );
    await addSession(app, { minutesAgo: 10, durationSeconds: 3000, taskId: 't1', deepFocus: 80 });
    await addSession(app, { minutesAgo: 90, durationSeconds: 1200, deepFocus: 100 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('Stats');

    expect(
      await screen.findByLabelText(/^Today: 4 percent|^Today: \d+ percent of the goal/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^This week: .*no goal set/)).toBeTruthy();
    expect(screen.getByLabelText(/^Current streak: [12] days?/)).toBeTruthy();
    expect(screen.getByLabelText(/^Deep focus: 86/)).toBeTruthy();
    expect(screen.getByLabelText('Task Write report: 50m')).toBeTruthy();
    expect(screen.getByLabelText(/^Focus minutes per day\./)).toBeTruthy();
  });

  it('switches the chart between day, week and month', async () => {
    const app = createApp();
    await addSession(app, { minutesAgo: 10 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('Stats');
    await screen.findByLabelText(/^Focus minutes per day\./);
    await fireEvent.press(screen.getByLabelText('Week'));
    expect(await screen.findByLabelText(/^Focus minutes per week\./)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Month'));
    expect(await screen.findByLabelText(/^Focus minutes per month\./)).toBeTruthy();
  });

  it('draws the heatmap and describes a tapped day', async () => {
    const app = createApp();
    await addSession(app, { minutesAgo: 10, durationSeconds: 1800 });
    await renderWithApp(<PomodoroScreen />, app);
    await open('Stats');
    const container = await screen.findByTestId('pomodoro-heatmap');
    await fireEvent(container, 'layout', { nativeEvent: { layout: { width: 360, height: 100 } } });
    expect(await screen.findByLabelText(/^Focus time over the last \d+ weeks/)).toBeTruthy();
    expect(screen.getByText('Tap a day for details')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/: 30m$/));
    expect(await screen.findByText(/: 30m$/)).toBeTruthy();
  });
});
