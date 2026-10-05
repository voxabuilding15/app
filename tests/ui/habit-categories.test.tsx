import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { HabitCategoriesScreen } from '@/features/habits/presentation/screens/HabitCategoriesScreen';

import { createApp, renderWithApp } from './harness';

describe('HabitCategoriesScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('adds, renames and deletes a category, rejecting duplicates', async () => {
    const app = createApp();
    await renderWithApp(<HabitCategoriesScreen />, app);
    expect(await screen.findByText('No categories yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add category')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Health');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Health')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Add category'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'health');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Cancel'));

    await fireEvent.press(screen.getByLabelText('Edit Health'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Mind');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Mind')).toBeTruthy();

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByLabelText('Delete Mind'));
    alert.mock.calls[0]?.[2]?.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Mind')).toBeNull());
    expect(await app.habits.categories.list()).toHaveLength(0);
  });
});
