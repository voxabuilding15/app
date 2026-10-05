import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { addDaysToKey, toDateKey } from '@/core';
import { emptyHabitDraft, type HabitDraft } from '@/features/habits/domain/validation';
import { HabitDetailScreen } from '@/features/habits/presentation/screens/HabitDetailScreen';

import { createApp, renderWithApp, router, type TestApp } from './harness';

const today = () => toDateKey(Date.now());
const day = (offset: number) => addDaysToKey(today(), offset);

async function seeded(overrides: Partial<HabitDraft> = {}, history: number[] = []) {
  const app = createApp();
  const result = await app.habits.save(
    {
      ...emptyHabitDraft('menu-book', '#2563EB'),
      name: 'Read',
      notes: 'Fiction only',
      ...overrides,
    },
    null,
  );
  if (!result.ok) {
    throw new Error('seed failed');
  }
  for (const offset of history) {
    await app.habits.setCount(result.id, day(offset), 1);
  }
  return { app, id: result.id };
}

async function show(app: TestApp, id: string) {
  const utils = await renderWithApp(<HabitDetailScreen habitId={id} />, app);
  await screen.findByText('Logged today');
  return utils;
}

/** The heatmap sizes itself from its container, which never lays out in tests. */
async function layoutHeatmap(width = 360) {
  await fireEvent(screen.getByTestId('heatmap-container'), 'layout', {
    nativeEvent: { layout: { width, height: 200, x: 0, y: 0 } },
  });
}

describe('HabitDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the habit, its progress, notes and statistics', async () => {
    const { app, id } = await seeded({ goalCount: 2, reminderTime: '07:30' }, [-2, -1]);
    await show(app, id);

    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('0 of 2 today')).toBeTruthy();
    expect(screen.getByText('Fiction only')).toBeTruthy();
    expect(screen.getByLabelText(/Current streak: 0 days/)).toBeTruthy(); // goal 2 not met on those days
    expect(screen.getByLabelText(/Total completions: 2/)).toBeTruthy();
    expect(screen.getByLabelText('Last 7 days against a goal of 2', { exact: false })).toBeTruthy();
  });

  it('computes streaks and success rate from history', async () => {
    const { app, id } = await seeded({}, [-3, -2, -1, 0]);
    await show(app, id);
    expect(screen.getByLabelText(/Current streak: 4 days/)).toBeTruthy();
    expect(screen.getByLabelText(/Best streak: 4 days/)).toBeTruthy();
    expect(screen.getByLabelText(/Success rate: 100%/)).toBeTruthy();
  });

  it("adjusts today's count with the stepper", async () => {
    const { app, id } = await seeded({ goalCount: 3 });
    await show(app, id);

    await fireEvent.press(screen.getByLabelText('Increase Completions today'));
    await fireEvent.press(await screen.findByLabelText('Increase Completions today'));
    expect(await screen.findByText('2 of 3 today')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Decrease Completions today'));
    expect(await screen.findByText('1 of 3 today')).toBeTruthy();
  });

  it('skips and unskips today', async () => {
    const { app, id } = await seeded();
    await show(app, id);
    await fireEvent.press(screen.getByLabelText('Skip today'));
    expect(await screen.findByLabelText('Unskip today')).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unskip today'));
    expect(await screen.findByLabelText('Skip today')).toBeTruthy();
  });

  it('pauses and resumes the habit', async () => {
    const { app, id } = await seeded();
    await show(app, id);
    await fireEvent.press(screen.getByLabelText('Pause habit'));
    expect(await screen.findByLabelText('Resume habit')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.queryByText('Logged today')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Resume habit'));
    expect(await screen.findByText('Logged today')).toBeTruthy();
  });

  it('renders the calendar heatmap and edits a past day from its sheet', async () => {
    const { app, id } = await seeded({}, [-1]);
    await show(app, id);
    await layoutHeatmap();

    const yesterday = screen.getByLabelText(/: 1 of 1$/);
    expect(yesterday).toBeTruthy();
    expect(screen.getByLabelText(/: nothing logged$/)).toBeTruthy();

    await fireEvent.press(yesterday);
    expect(await screen.findByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('1 logged on this day.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Decrease Completions on this day'));
    expect(await screen.findByText('Nothing logged on this day.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Skip day'));
    expect(await screen.findByText(/skipped, so it does not affect your streak/)).toBeTruthy();
    expect((await app.habits.detail(id))?.entry.logs.at(-1)).toMatchObject({
      date: day(-1),
      status: 'skipped',
    });

    await fireEvent.press(screen.getByLabelText('Done'));
    await waitFor(() => expect(screen.queryByText('Yesterday')).toBeNull());
  });

  it('explains when the habit no longer exists', async () => {
    await renderWithApp(<HabitDetailScreen habitId="missing" />);
    expect(await screen.findByText('Habit not found')).toBeTruthy();
  });

  it('opens the editor from the header', async () => {
    const { app, id } = await seeded();
    await show(app, id);
    await fireEvent.press(screen.getByLabelText('Edit habit'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/habits/[id]/edit', params: { id } });
  });

  it('archives from the header and leaves the screen', async () => {
    const { app, id } = await seeded();
    await show(app, id);
    await fireEvent.press(screen.getByLabelText('Archive habit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.habits.detail(id))?.entry.habit.archivedAt).not.toBeNull();
  });

  it('deletes only after confirmation, then leaves the screen', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { app, id } = await seeded({}, [-1]);
    await show(app, id);

    await fireEvent.press(screen.getByLabelText('Delete habit'));
    expect(alert).toHaveBeenCalledWith(
      'Delete this habit?',
      expect.stringContaining('permanently'),
      expect.any(Array),
    );
    expect(await app.habits.detail(id)).not.toBeNull();

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await app.habits.detail(id)).toBeNull();
  });

  it('shows an archived habit without logging controls', async () => {
    const { app, id } = await seeded();
    await act(async () => app.habits.archive(id));
    await renderWithApp(<HabitDetailScreen habitId={id} />, app);
    expect(await screen.findByText(/Archived/)).toBeTruthy();
    expect(screen.queryByText('Logged today')).toBeNull();
  });
});
