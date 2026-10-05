import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { addDaysToKey, toDateKey } from '@/core';
import { EventFormScreen } from '@/features/calendar/presentation/screens/EventFormScreen';

import { seedEvents, settle, todayStart } from './calendar-seed';
import { createApp, renderWithApp, router, type TestApp } from './harness';

const openPicker = DateTimePickerAndroid.open as jest.Mock;

function pickerReturns(date: Date) {
  openPicker.mockImplementation(({ onChange }: { onChange: (e: object, d?: Date) => void }) =>
    onChange({ type: 'set' }, date),
  );
}

const today = () => toDateKey(Date.now());
const NONE = { day: null, minutes: null };
const anywhere = (app: TestApp) =>
  app.calendar.items(addDaysToKey(today(), -1), addDaysToKey(today(), 60));
const events = async (app: TestApp) =>
  (await anywhere(app)).filter((item) => item.kind === 'event');

function answerAlert(button: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((candidate) => candidate.text === button)?.onPress?.();
  });
}

describe('EventFormScreen (create)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('blocks saving without a title and explains why', async () => {
    const app = await renderWithApp(
      <EventFormScreen eventId={null} occurrenceDate={null} defaults={NONE} />,
    );
    await fireEvent.press(screen.getByLabelText('Create event'));
    expect(await screen.findByText('Enter a title')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await events(app)).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Now valid');
    await waitFor(() => expect(screen.queryByText('Enter a title')).toBeNull());
  });

  it('creates an event on the requested day and time with a repeat and a reminder', async () => {
    const day = addDaysToKey(today(), 3);
    const app = createApp();
    const category = await app.calendar.categories.save({
      id: null,
      name: 'Work',
      color: '#2563EB',
    });
    await renderWithApp(
      <EventFormScreen eventId={null} occurrenceDate={null} defaults={{ day, minutes: 14 * 60 }} />,
      app,
    );

    await fireEvent.changeText(screen.getByLabelText('Title'), 'Design review');
    await fireEvent.changeText(screen.getByLabelText('Location'), 'Room 4');
    await fireEvent.press(await screen.findByText('Work'));
    await fireEvent.press(screen.getByText('Weekly'));
    await fireEvent.press(screen.getByText('After a number'));
    await fireEvent.press(screen.getByText('15 min before'));
    await fireEvent.press(screen.getByLabelText('Create event'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const saved = (await events(app))[0];
    expect(saved).toMatchObject({
      kind: 'event',
      title: 'Design review',
      location: 'Room 4',
      recurring: true,
    });
    expect(saved?.kind === 'event' && saved.categoryId).toBe(category.ok ? category.id : null);
    expect(new Date(saved?.start ?? 0).getHours()).toBe(14);
    expect(toDateKey(saved?.start ?? 0)).toBe(day);
    expect(app.notifications.scheduled).toContain('Design review');
  });

  it('creates an all-day event that spans a day', async () => {
    const app = await renderWithApp(
      <EventFormScreen eventId={null} occurrenceDate={null} defaults={NONE} />,
    );
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Holiday');
    await fireEvent(screen.getByLabelText('All day'), 'valueChange', true);
    await fireEvent.press(screen.getByLabelText('Create event'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await events(app);
    expect(saved).toMatchObject({ title: 'Holiday', allDay: true });
    expect(saved?.start).toBe(todayStart());
  });

  it('rejects an end before the start', async () => {
    pickerReturns(new Date(2030, 0, 1, 0, 0));
    const app = await renderWithApp(
      <EventFormScreen
        eventId={null}
        occurrenceDate={null}
        defaults={{ day: today(), minutes: 600 }}
      />,
    );
    await fireEvent.changeText(screen.getByLabelText('Title'), 'Backwards');
    await fireEvent.press(screen.getByLabelText(/^Ends time/));
    await fireEvent.press(screen.getByLabelText('Create event'));
    expect(await screen.findByText('The event must end after it starts')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await events(app)).toHaveLength(0);
  });
});

describe('EventFormScreen (edit)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('loads the event, saves changes and returns', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning', notes: 'Agenda' }]);
    await renderWithApp(
      <EventFormScreen eventId={id!} occurrenceDate={today()} defaults={NONE} />,
      app,
    );

    const title = await screen.findByDisplayValue('Planning');
    expect(screen.getByDisplayValue('Agenda')).toBeTruthy();
    await fireEvent.changeText(title, 'Sprint planning');
    await fireEvent.press(screen.getByLabelText('Save changes'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await events(app))[0]).toMatchObject({ title: 'Sprint planning' });
  });

  it('says when the event no longer exists', async () => {
    await renderWithApp(
      <EventFormScreen eventId="missing" occurrenceDate={null} defaults={NONE} />,
    );
    expect(await screen.findByText('Event not found')).toBeTruthy();
  });

  it('asks before deleting a single event', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(
      <EventFormScreen eventId={id!} occurrenceDate={today()} defaults={NONE} />,
      app,
    );
    await screen.findByDisplayValue('Planning');

    const alert = answerAlert('Delete');
    await fireEvent.press(screen.getByLabelText('Delete event'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await events(app)).toHaveLength(0);
  });

  const daily = { unit: 'day', interval: 1, weekdays: 0, until: null, count: null } as const;

  it('applies a recurring edit to only the chosen occurrence', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Standup', recurrence: daily }]);
    await renderWithApp(
      <EventFormScreen eventId={id!} occurrenceDate={today()} defaults={NONE} />,
      app,
    );

    await fireEvent.changeText(await screen.findByDisplayValue('Standup'), 'Standup (special)');
    answerAlert('This event');
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());

    const titles = (await app.calendar.items(today(), addDaysToKey(today(), 1))).map(
      (item) => item.title,
    );
    expect(titles).toContain('Standup (special)');
    expect(titles).toContain('Standup');
  });

  it('deletes the whole series when asked', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Standup', recurrence: daily }]);
    await renderWithApp(
      <EventFormScreen eventId={id!} occurrenceDate={today()} defaults={NONE} />,
      app,
    );
    await screen.findByDisplayValue('Standup');

    answerAlert('All events');
    await fireEvent.press(screen.getByLabelText('Delete event'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await events(app)).toHaveLength(0);
  });

  it('keeps the series when the scope prompt is cancelled', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Standup', recurrence: daily }]);
    await renderWithApp(
      <EventFormScreen eventId={id!} occurrenceDate={today()} defaults={NONE} />,
      app,
    );
    await screen.findByDisplayValue('Standup');

    answerAlert('Cancel');
    await fireEvent.press(screen.getByLabelText('Delete event'));
    await settle();
    expect(router.back).not.toHaveBeenCalled();
    expect((await events(app)).length).toBeGreaterThan(0);
  });
});
