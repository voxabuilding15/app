import { screen } from '@testing-library/react-native';

import { CalendarScreen } from '@/features/calendar/presentation/screens/CalendarScreen';
import { EventFormScreen } from '@/features/calendar/presentation/screens/EventFormScreen';

import { seedEvents } from './calendar-seed';
import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1100, height: 800, scale: 2, fontScale: 1 }),
}));

describe('calendar tablet layout (1100 x 800)', () => {
  it('shows the month grid beside the selected day agenda', async () => {
    const app = createApp();
    await seedEvents(app, [{ title: 'Planning' }]);
    await renderWithApp(<CalendarScreen />, app);
    // The agenda panel only sits next to the grid at this width, so the event is listed in it.
    expect(await screen.findByLabelText(/^Event: Planning/)).toBeTruthy();
    expect(screen.getByText(/^Today · /)).toBeTruthy();
  });

  it('renders every event form section side by side without losing any', async () => {
    await renderWithApp(
      <EventFormScreen
        eventId={null}
        occurrenceDate={null}
        defaults={{ day: null, minutes: null }}
      />,
    );
    for (const section of ['Details', 'When', 'Repeat', 'Reminder', 'Category']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
    expect(screen.getByLabelText('Create event')).toBeTruthy();
  });
});
