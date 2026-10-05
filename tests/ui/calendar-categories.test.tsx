import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { CalendarCategoriesScreen } from '@/features/calendar/presentation/screens/CalendarCategoriesScreen';

import { createApp, renderWithApp } from './harness';

describe('CalendarCategoriesScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds, renames and deletes an event category, rejecting duplicates', async () => {
    const app = createApp();
    await renderWithApp(<CalendarCategoriesScreen />, app);
    expect(await screen.findByText('No categories yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add category')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Work');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Work')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add category'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'work');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));

    await fireEvent.press(screen.getByLabelText('Edit Work'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Family');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Family')).toBeTruthy();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByLabelText('Delete Family'));
    alert.mock.calls[0]?.[2]?.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Family')).toBeNull());
    expect(await app.calendar.categories.list()).toHaveLength(0);
  });
});
