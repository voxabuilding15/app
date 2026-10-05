import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { addDaysToKey, toDateKey } from '@/core';
import { emptyHabitDraft, type HabitDraft } from '@/features/habits/domain/validation';
import { HabitListScreen } from '@/features/habits/presentation/screens/HabitListScreen';

import { renderWithApp, router, type TestApp } from './harness';

const today = () => toDateKey(Date.now());

async function seed(app: TestApp, drafts: Partial<HabitDraft>[]) {
  const ids: string[] = [];
  await act(async () => {
    for (const draft of drafts) {
      const result = await app.habits.save(
        { ...emptyHabitDraft('self-improvement', '#7B2FF7'), name: 'Habit', ...draft },
        null,
      );
      if (!result.ok) {
        throw new Error('seed failed');
      }
      ids.push(result.id);
    }
    await app.client.invalidateQueries({ queryKey: ['habits'] });
  });
  return ids;
}

const row = (name: string) => screen.getByLabelText(new RegExp(`^${name}, `));
const gone = (text: string) => waitFor(() => expect(screen.queryByText(text)).toBeNull());

describe('HabitListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state with a working add action', async () => {
    await renderWithApp(<HabitListScreen />);
    expect(await screen.findByText('No habits yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add habit')[0]!);
    expect(router.push).toHaveBeenCalledWith('/habits/new');
  });

  it("lists habits with today's overview and opens a habit when pressed", async () => {
    const app = await renderWithApp(<HabitListScreen />);
    const [id] = await seed(app, [{ name: 'Read' }, { name: 'Stretch' }]);
    expect(await screen.findByText('Read')).toBeTruthy();
    expect(screen.getByText('0 of 2 habits done today')).toBeTruthy();

    await fireEvent.press(row('Read'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/habits/[id]', params: { id } });
  });

  it('completes a once-a-day habit from its checkbox and updates the overview', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Read' }, { name: 'Stretch' }]);
    await screen.findByText('Read');

    await fireEvent.press(screen.getByLabelText('Read: mark as done today'));
    expect(await screen.findByText('1 of 2 habits done today')).toBeTruthy();
    expect(await screen.findByText('1 day')).toBeTruthy(); // streak badge

    await fireEvent.press(screen.getByLabelText('Read: mark as not done today'));
    expect(await screen.findByText('0 of 2 habits done today')).toBeTruthy();
  });

  it('adds and removes completions for multi-count habits', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Water', goalCount: 3 }]);
    await screen.findByText('Water');
    expect(screen.getByText('0 of 3 today')).toBeTruthy();
    expect(screen.queryByLabelText('Remove one from Water')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Add one to Water'));
    await fireEvent.press(await screen.findByLabelText('Add one to Water'));
    expect(await screen.findByText('2 of 3 today')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove one from Water'));
    expect(await screen.findByText('1 of 3 today')).toBeTruthy();
  });

  it('skips today with a swipe action and lets you undo it', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Run' }]);
    await screen.findByText('Run');

    await fireEvent.press(screen.getByLabelText('Skip today'));
    expect(await screen.findByText('Skipped today')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Unskip'));
    await gone('Skipped today');
    expect(screen.getByLabelText('Run: mark as done today')).toBeTruthy();
  });

  it('shows paused habits without logging controls', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    const [id] = await seed(app, [{ name: 'Journal' }]);
    await act(async () => {
      await app.habits.pause(id!);
      await app.client.invalidateQueries({ queryKey: ['habits'] });
    });
    expect(await screen.findByText('Paused')).toBeTruthy();
    expect(screen.queryByLabelText('Journal: mark as done today')).toBeNull();
  });

  it('archives with a swipe action and restores from the Archived tab', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Old habit' }]);
    await screen.findByText('Old habit');

    await fireEvent.press(screen.getByLabelText('Archive'));
    await gone('Old habit');
    expect(await screen.findByText('Old habit archived')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Archived'));
    expect(await screen.findByText('Old habit')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Restore'));
    await gone('Old habit');
    await fireEvent.press(screen.getByLabelText('Active'));
    expect(await screen.findByText('Old habit')).toBeTruthy();
  });

  it('asks before deleting and then removes the habit', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Doomed' }]);
    await screen.findByText('Doomed');

    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(alert).toHaveBeenCalledWith(
      'Delete "Doomed"?',
      expect.stringContaining('permanently'),
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());
    await gone('Doomed');
    expect(await screen.findByText('No habits yet')).toBeTruthy();
  });

  it('searches names and notes and recovers from no results', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Read' }, { name: 'Gym', notes: 'leg day' }]);
    await screen.findByText('Read');

    await fireEvent.press(screen.getByLabelText('Search habits'));
    await fireEvent.changeText(screen.getByPlaceholderText('Name or notes'), 'LEG');
    await gone('Read');
    expect(screen.getByText('Gym')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Name or notes'), 'zzz');
    expect(await screen.findByText('No matching habits')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear search and filters'));
    expect(await screen.findByText('Read')).toBeTruthy();
  });

  it('filters by frequency and status', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    const ids = await seed(app, [
      { name: 'Daily one' },
      { name: 'Weekly one', period: 'weekly', goalCount: 3 },
    ]);
    await screen.findByText('Daily one');

    await fireEvent.press(screen.getByLabelText('Filter'));
    await fireEvent.press(await screen.findByLabelText('Weekly'));
    await gone('Daily one');
    expect(screen.getByText('Weekly one')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Reset'));
    await act(async () => {
      await app.habits.setCount(ids[0]!, today(), 1);
      await app.client.invalidateQueries({ queryKey: ['habits'] });
    });
    await fireEvent.press(screen.getByLabelText('Due today'));
    await gone('Daily one'); // already done today, so no longer due
    expect(screen.getByText('Weekly one')).toBeTruthy();
  });

  it('sorts by name in descending order', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    await seed(app, [{ name: 'Alpha' }, { name: 'Zulu' }]);
    await screen.findByText('Alpha');

    await fireEvent.press(screen.getByLabelText(/^Sort by Date created/));
    await fireEvent.press(await screen.findByLabelText('Name'));
    await fireEvent.press(screen.getByLabelText('Descending'));
    await waitFor(() => {
      const labels = screen
        .getAllByLabelText(/of 1 today/)
        .map((n) => n.props.accessibilityLabel as string);
      expect(labels[0]).toMatch(/^Zulu/);
    });
  });

  it('shows the streak across consecutive days of history', async () => {
    const app = await renderWithApp(<HabitListScreen />);
    const [id] = await seed(app, [{ name: 'Meditate' }]);
    await act(async () => {
      for (const offset of [-2, -1, 0]) {
        await app.habits.setCount(id!, addDaysToKey(today(), offset), 1);
      }
      await app.client.invalidateQueries({ queryKey: ['habits'] });
    });
    expect(await screen.findByText('3 days')).toBeTruthy();
  });
});
