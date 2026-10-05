import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { weekdayBit } from '@/core';
import { emptyHabitDraft } from '@/features/habits/domain/validation';
import { HabitFormScreen } from '@/features/habits/presentation/screens/HabitFormScreen';

import { createApp, renderWithApp, router } from './harness';

const openPicker = DateTimePickerAndroid.open as jest.Mock;

const all = (app: ReturnType<typeof createApp>) => app.habits.list('active');

describe('HabitFormScreen (create)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires a name and explains why', async () => {
    const app = await renderWithApp(<HabitFormScreen habitId={null} />);
    await fireEvent.press(screen.getByLabelText('Create habit'));
    expect(await screen.findByText('Enter a name')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await all(app)).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Walk');
    await waitFor(() => expect(screen.queryByText('Enter a name')).toBeNull());
  });

  it('creates a habit with icon, color, category, goal and reminder', async () => {
    openPicker.mockImplementation(({ onChange }: { onChange: (e: object, d?: Date) => void }) =>
      onChange({ type: 'set' }, new Date(2000, 0, 1, 18, 45)),
    );
    const app = await renderWithApp(<HabitFormScreen habitId={null} />);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Drink water');
    await fireEvent.changeText(screen.getByLabelText('Notes'), '2 litres');
    await fireEvent.press(screen.getByLabelText('local drink'));
    await fireEvent.press(screen.getByLabelText('Color 3 of 8'));
    for (let i = 0; i < 7; i += 1) {
      await fireEvent.press(screen.getByLabelText('Increase Goal per day'));
    }

    await fireEvent.press(screen.getByLabelText('Create a category'));
    await fireEvent.changeText(
      await screen
        .findByLabelText('Name', { hidden: true, exact: true })
        .catch(() => screen.getAllByLabelText('Name')[1]!),
      'Health',
    );
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(screen.getByLabelText('Health')).toBeTruthy());

    await fireEvent(screen.getByLabelText('Remind me'), 'valueChange', true);
    await fireEvent.press(await screen.findByLabelText(/^Reminder time/));
    await fireEvent.press(screen.getByLabelText('Create habit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const [summary] = await all(app);
    expect(summary?.habit).toMatchObject({
      name: 'Drink water',
      notes: '2 litres',
      icon: 'local-drink',
      color: '#0891B2',
      period: 'daily',
      goalCount: 8,
      reminderTime: '18:45',
    });
    expect(summary?.habit.category?.name).toBe('Health');
    expect(app.notifications.scheduled).toEqual(['Drink water']);
  });

  it('offers weekday selection for custom frequency and saves it', async () => {
    const app = await renderWithApp(<HabitFormScreen habitId={null} />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Gym');
    expect(screen.queryByText('Scheduled days')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Custom days'));
    expect(await screen.findByText('Scheduled days')).toBeTruthy();
    // Default custom schedule is Monday to Friday; switch it to Mon, Wed, Sat.
    await fireEvent.press(screen.getByLabelText('Tue'));
    await fireEvent.press(screen.getByLabelText('Thu'));
    await fireEvent.press(screen.getByLabelText('Fri'));
    await fireEvent.press(screen.getByLabelText('Sat'));
    await fireEvent.press(screen.getByLabelText('Create habit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const [summary] = await all(app);
    expect(summary?.habit.weekdays).toBe(weekdayBit(1) | weekdayBit(3) | weekdayBit(6));
  });

  it('refuses a custom schedule with no days selected', async () => {
    const app = await renderWithApp(<HabitFormScreen habitId={null} />);
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Gym');
    await fireEvent.press(screen.getByLabelText('Custom days'));
    for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await fireEvent.press(await screen.findByLabelText(label));
    }
    await fireEvent.press(screen.getByLabelText('Create habit'));
    expect(await screen.findByText('Choose at least one day')).toBeTruthy();
    expect(await all(app)).toHaveLength(0);
  });

  it('switches goal wording for weekly and monthly habits', async () => {
    await renderWithApp(<HabitFormScreen habitId={null} />);
    expect(screen.getByText('Goal per day')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Weekly'));
    expect(await screen.findByText('Goal per week')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Monthly'));
    expect(await screen.findByText('Goal per month')).toBeTruthy();
  });

  it('keeps the goal between 1 and 99', async () => {
    await renderWithApp(<HabitFormScreen habitId={null} />);
    expect(screen.getByLabelText('Decrease Goal per day').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('saves the habit but warns when notifications are blocked', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const app = createApp();
    app.notifications.getPermissionState = async () => 'denied';
    await renderWithApp(<HabitFormScreen habitId={null} />, app);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Stretch');
    await fireEvent(screen.getByLabelText('Remind me'), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText('Create habit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith('Reminder will not fire', expect.any(String));
    expect(await all(app)).toHaveLength(1);
    expect(app.notifications.scheduled).toHaveLength(0);
  });
});

describe('HabitFormScreen (edit)', () => {
  beforeEach(() => jest.clearAllMocks());

  async function seeded() {
    const app = createApp();
    const result = await app.habits.save(
      {
        ...emptyHabitDraft('menu-book', '#2563EB'),
        name: 'Read',
        notes: 'Fiction',
        goalCount: 2,
        period: 'weekly',
      },
      null,
    );
    if (!result.ok) {
      throw new Error('seed failed');
    }
    return { app, id: result.id };
  }

  it('loads and saves edits while keeping history', async () => {
    const { app, id } = await seeded();
    await app.habits.setCount(id, new Date().toISOString().slice(0, 10), 1);
    await renderWithApp(<HabitFormScreen habitId={id} />, app);

    expect(await screen.findByDisplayValue('Read')).toBeTruthy();
    expect(screen.getByDisplayValue('Fiction')).toBeTruthy();
    expect(screen.getByLabelText('Weekly').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Save changes')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Read daily');
    await fireEvent.press(screen.getByLabelText('Daily'));
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const detail = await app.habits.detail(id);
    expect(detail?.entry.habit).toMatchObject({
      name: 'Read daily',
      period: 'daily',
      goalCount: 2,
    });
    expect(detail?.entry.logs).toHaveLength(1);
  });

  it('explains when the habit no longer exists', async () => {
    await renderWithApp(<HabitFormScreen habitId="missing" />);
    expect(await screen.findByText('Habit not found')).toBeTruthy();
  });
});
