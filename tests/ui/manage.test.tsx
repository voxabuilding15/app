import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ManageScreen } from '@/features/tasks/presentation/screens/ManageScreen';

import { createApp, renderWithApp } from './harness';

describe('ManageScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds, edits and deletes a category', async () => {
    const app = createApp();
    await renderWithApp(<ManageScreen />, app);
    expect(await screen.findByText('No categories yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add category')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Errands');
    await fireEvent.press(screen.getByLabelText('Color 3 of 8'));
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Errands')).toBeTruthy();
    expect((await app.tasks.taxonomy.categories())[0]?.color).toBe('#0891B2');

    await fireEvent.press(screen.getByLabelText('Edit Errands'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Chores');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Chores')).toBeTruthy();
    expect(screen.queryByText('Errands')).toBeNull();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByLabelText('Delete Chores'));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    buttons.find((button) => button.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Chores')).toBeNull());
    expect(await screen.findByText('No categories yet')).toBeTruthy();
  });

  it('validates names and keeps labels separate from categories', async () => {
    const app = createApp();
    await app.tasks.taxonomy.saveLabel({ id: null, name: 'Urgent', color: '#000' });
    await renderWithApp(<ManageScreen />, app);

    await fireEvent.press(screen.getByLabelText('Labels'));
    expect(await screen.findByText('Urgent')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add label'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), '   ');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Enter a name')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Name'), 'URGENT');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Cancel'));
    await fireEvent.press(screen.getByLabelText('Categories'));
    expect(await screen.findByText('No categories yet')).toBeTruthy();
  });
});
