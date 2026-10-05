import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Dimensions } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { addDaysToKey, toDateKey } from '@/core';
import { CalendarScreen } from '@/features/calendar/presentation/screens/CalendarScreen';

import { HOUR, seedEvents, settle } from './calendar-seed';
import { createApp, renderWithApp, type TestApp } from './harness';

const HOUR_HEIGHT = 56;
const today = () => toDateKey(Date.now());
const tomorrow = () => addDaysToKey(today(), 1);

async function startOf(app: TestApp, id: string) {
  const items = await app.calendar.items(today(), today());
  const event = items.find((item) => item.kind === 'event' && item.eventId === id);
  if (event === undefined) {
    throw new Error('event not found');
  }
  return event;
}

function drag(testId: string, translationX: number, translationY: number) {
  fireGestureHandler(getByGestureTestId(testId), [
    { state: State.BEGAN },
    { state: State.ACTIVE },
    { translationX, translationY },
    { state: State.END, translationX, translationY },
  ]);
}

describe('dragging events on the timeline', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('moves an event to a new time, snapped to 15 minutes', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    await screen.findByLabelText(/^Event: Planning, /);
    const before = await startOf(app, id!);

    // 1h + 9 minutes down rounds to 1h 15m? 66px = 70.7 minutes → snaps to 75.
    drag(`block:${before.key}`, 0, (HOUR_HEIGHT * 70) / 60);

    await waitFor(async () => {
      const after = await startOf(app, id!);
      expect(after.start - before.start).toBe(75 * 60_000);
    });
    expect(await screen.findByText('Event moved')).toBeTruthy();
  });

  it('leaves the event alone when it is barely moved', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    await screen.findByLabelText(/^Event: Planning, /);
    const before = await startOf(app, id!);

    drag(`block:${before.key}`, 0, 3);
    await settle();
    expect((await startOf(app, id!)).start).toBe(before.start);
  });

  it('moves an event to another day in the week view', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Week'));
    await screen.findByLabelText(/^Event: Planning, /);
    const before = await startOf(app, id!);

    // A day column is roughly an eighth of the body (seven days plus the hour gutter).
    const { width } = Dimensions.get('window');
    drag(`block:${before.key}`, width / 8, 0);

    await waitFor(async () => {
      const items = await app.calendar.items(tomorrow(), tomorrow());
      expect(items.some((item) => item.kind === 'event' && item.eventId === id)).toBe(true);
    });
  });

  it('asks whether to move one occurrence or the series for recurring events', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [
      {
        title: 'Standup',
        recurrence: { unit: 'day', interval: 1, weekdays: 0, until: null, count: null },
      },
    ]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'All events')?.onPress?.();
    });
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    await screen.findByLabelText(/^Event: Standup, /);
    const before = await startOf(app, id!);

    drag(`block:${before.key}`, 0, HOUR_HEIGHT);

    await waitFor(() => expect(alert).toHaveBeenCalled());
    await waitFor(async () => {
      expect((await startOf(app, id!)).start - before.start).toBe(HOUR);
    });
  });

  it('snaps back without changes when the scope prompt is cancelled', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [
      {
        title: 'Standup',
        recurrence: { unit: 'day', interval: 1, weekdays: 0, until: null, count: null },
      },
    ]);
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Cancel')?.onPress?.();
    });
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    await screen.findByLabelText(/^Event: Standup, /);
    const before = await startOf(app, id!);

    drag(`block:${before.key}`, 0, HOUR_HEIGHT);
    await settle();
    expect((await startOf(app, id!)).start).toBe(before.start);
  });

  it('offers move actions to screen readers', async () => {
    const app = createApp();
    const [id] = await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    await fireEvent.press(await screen.findByLabelText('Day'));
    const block = await screen.findByLabelText(/^Event: Planning, /);
    const before = await startOf(app, id!);

    await fireEvent(block, 'accessibilityAction', { nativeEvent: { actionName: 'later' } });
    await waitFor(async () => {
      expect((await startOf(app, id!)).start - before.start).toBe(15 * 60_000);
    });
    await fireEvent(block, 'accessibilityAction', { nativeEvent: { actionName: 'nextDay' } });
    await waitFor(async () => {
      const items = await app.calendar.items(tomorrow(), tomorrow());
      expect(items.some((item) => item.kind === 'event' && item.eventId === id)).toBe(true);
    });
  });
});
