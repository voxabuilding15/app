import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { toDateKey } from '@/core';
import { emptyHabitDraft } from '@/features/habits/domain/validation';
import { emptyDraft } from '@/features/tasks/domain/validation';
import { CalendarScreen } from '@/features/calendar/presentation/screens/CalendarScreen';

import { eventDraft, seedEvents, todayStart, HOUR } from './calendar-seed';
import { createApp, renderWithApp, router } from './harness';

const today = () => toDateKey(Date.now());

describe('CalendarScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens on the month view with today selected and lists its agenda', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);

    expect(await screen.findByLabelText(/^Event: Planning/)).toBeTruthy();
    expect(screen.getByLabelText(/, today, 1 item$/)).toBeTruthy();
    expect(screen.getByLabelText('Next month')).toBeTruthy();
  });

  it('shows tasks and habits together with events', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await app.tasks.tasks.save(
      {
        ...emptyDraft(),
        title: 'File taxes',
        due: { at: todayStart() + 15 * HOUR, hasTime: true },
      },
      null,
    );
    await app.habits.save({ ...emptyHabitDraft('menu-book', '#2563EB'), name: 'Read' }, null);
    await renderWithApp(<CalendarScreen />, app);

    expect(await screen.findByLabelText(/^Event: Planning/)).toBeTruthy();
    expect(await screen.findByLabelText(/^Task: File taxes/)).toBeTruthy();
    expect(await screen.findByLabelText(/^Habit: Read/)).toBeTruthy();
  });

  it('opens the right screen for events, tasks and habits', async () => {
    const app = createApp();
    const [eventId] = await seedEvents(app, [{ title: 'Planning' }]);
    const task = await app.tasks.tasks.save(
      {
        ...emptyDraft(),
        title: 'File taxes',
        due: { at: todayStart() + 15 * HOUR, hasTime: true },
      },
      null,
    );
    const habit = await app.habits.save(
      { ...emptyHabitDraft('menu-book', '#2563EB'), name: 'Read' },
      null,
    );
    await renderWithApp(<CalendarScreen />, app);

    await fireEvent.press(await screen.findByLabelText(/^Event: Planning/));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/calendar/event/[id]',
      params: { id: eventId, occurrence: today() },
    });
    await fireEvent.press(screen.getByLabelText(/^Task: File taxes/));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/tasks/[id]',
      params: { id: task.ok ? task.id : '' },
    });
    await fireEvent.press(screen.getByLabelText(/^Habit: Read/));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/habits/[id]',
      params: { id: habit.ok ? habit.id : '' },
    });
  });

  it('adds an event for the selected day from the button', async () => {
    await renderWithApp(<CalendarScreen />);
    await screen.findByText('Nothing planned for this day.');
    await fireEvent.press(screen.getAllByLabelText('Add event')[0]!);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/calendar/event/new',
      params: { day: today() },
    });
  });

  it('selects another day in the grid and steps between months', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByLabelText(/^Event: Planning/);

    const nextMonth = new Date(todayStart());
    nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    await fireEvent.press(screen.getByLabelText('Next month'));
    await waitFor(() => expect(screen.queryByLabelText(/^Event: Planning/)).toBeNull());
    await fireEvent.press(screen.getByLabelText('Today'));
    expect(await screen.findByLabelText(/^Event: Planning/)).toBeTruthy();
  });

  it('shows the week and day timelines with the event block', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);

    await fireEvent.press(await screen.findByLabelText('Week'));
    expect(await screen.findByLabelText(/^Event: Planning, /)).toBeTruthy();
    expect(screen.getByLabelText('Previous week')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Day'));
    expect(await screen.findByLabelText(/^Event: Planning, /)).toBeTruthy();
    expect(screen.getByLabelText('Next day')).toBeTruthy();
  });

  it('shows all-day events above the timeline', async () => {
    const app = createApp();
    await seedEvents(app, [
      { title: 'Holiday', allDay: true, start: todayStart(), end: todayStart() + 24 * HOUR },
    ]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    expect(await screen.findByLabelText('All day: Holiday')).toBeTruthy();
  });

  it('lists upcoming days in the agenda view', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Agenda'));
    expect(await screen.findByLabelText(/^Event: Planning/)).toBeTruthy();
  });

  it('shows an empty agenda with an add action', async () => {
    await renderWithApp(<CalendarScreen />);
    await fireEvent.press(await screen.findByLabelText('Agenda'));
    expect(await screen.findByText('Nothing planned')).toBeTruthy();
  });

  it('searches events, tasks and habits across the year', async () => {
    const app = createApp();
    await seedEvents(app, [
      { title: 'Dentist' },
      {
        title: 'Lunch',
        start: todayStart() + 40 * 24 * HOUR + 12 * HOUR,
        end: todayStart() + 40 * 24 * HOUR + 13 * HOUR,
      },
    ]);
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByLabelText(/^Event: Dentist/);

    await fireEvent.press(screen.getByLabelText('Search the calendar'));
    await fireEvent.changeText(screen.getByPlaceholderText('Events, tasks and habits'), 'lunch');
    expect(await screen.findByLabelText(/^Event: Lunch/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Event: Dentist/)).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText('Events, tasks and habits'), 'zzz');
    expect(await screen.findByText('No matches')).toBeTruthy();
  });

  it('filters by item kind and by event category', async () => {
    const app = createApp();
    const category = await app.calendar.categories.save({
      id: null,
      name: 'Work',
      color: '#2563EB',
    });
    await seedEvents(app, [
      { title: 'Planning', categoryId: category.ok ? category.id : null },
      { title: 'Dentist' },
    ]);
    await app.habits.save({ ...emptyHabitDraft('menu-book', '#2563EB'), name: 'Read' }, null);
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByLabelText(/^Event: Dentist/);

    await fireEvent.press(screen.getByLabelText(/^Filter/));
    await fireEvent.press(await screen.findByText('Work'));
    await fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByLabelText(/^Event: Dentist/)).toBeNull());
    expect(screen.getByLabelText(/^Event: Planning/)).toBeTruthy();
  });

  it('hides habits when that kind is turned off', async () => {
    const app = createApp();
    await app.habits.save({ ...emptyHabitDraft('menu-book', '#2563EB'), name: 'Read' }, null);
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByLabelText(/^Habit: Read/);

    await fireEvent.press(screen.getByLabelText(/^Filter/));
    await fireEvent.press(await screen.findByText('Habits'));
    await fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByLabelText(/^Habit: Read/)).toBeNull());
  });

  it('refreshes when data changes elsewhere', async () => {
    const app = createApp();
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByText('Nothing planned for this day.');
    await seedEvents(app, [{ title: 'Late arrival' }]);
    expect(await screen.findByLabelText(/^Event: Late arrival/)).toBeTruthy();
  });

  it('opens the category manager', async () => {
    await renderWithApp(<CalendarScreen />);
    await fireEvent.press(await screen.findByLabelText('Manage event categories'));
    expect(router.push).toHaveBeenCalledWith('/calendar/categories');
  });

  it('keeps events dated on other days out of the selected day', async () => {
    const app = createApp();
    await seedEvents(app, [
      {
        title: 'Tomorrow thing',
        start: eventDraft().start + 24 * HOUR,
        end: eventDraft().end + 24 * HOUR,
      },
    ]);
    await renderWithApp(<CalendarScreen />, app);
    await screen.findByText('Nothing planned for this day.');
    expect(screen.queryByLabelText(/^Event: Tomorrow thing/)).toBeNull();
    await act(async () => undefined);
  });
});
