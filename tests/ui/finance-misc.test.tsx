import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { toDateKey } from '@/core';
import { FinanceBridge } from '@/features/finance/presentation/FinanceBridge';
import { FinanceCategoriesScreen } from '@/features/finance/presentation/screens/FinanceCategoriesScreen';
import { DEFAULT_FILTER, DEFAULT_SORT } from '@/features/finance/domain/filters';

import { addAccount, addRecurring } from './finance-seed';
import { createApp, renderWithApp } from './harness';

describe('FinanceCategoriesScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('manages expense and income categories separately', async () => {
    const app = createApp();
    await renderWithApp(<FinanceCategoriesScreen />, app);
    expect(await screen.findByText('No categories yet')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Add category')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Groceries');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Groceries')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Income'));
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull());
    expect(await screen.findByText('No categories yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add category')[0]!);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Groceries');
    await fireEvent.press(screen.getByLabelText('Save'));
    expect(await screen.findByText('Groceries')).toBeTruthy(); // same name is fine in the other list

    expect((await app.finance.expenseCategories.list()).map((c) => c.name)).toEqual(['Groceries']);
    expect((await app.finance.incomeCategories.list()).map((c) => c.name)).toEqual(['Groceries']);

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByLabelText('Delete Groceries'));
    alert.mock.calls[0]?.[2]?.find((b) => b.style === 'destructive')?.onPress?.();
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull());
    expect(await app.finance.incomeCategories.list()).toHaveLength(0);
    expect(await app.finance.expenseCategories.list()).toHaveLength(1);
  });
});

describe('FinanceBridge', () => {
  it('records recurring transactions that fell due while the app was closed', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank', { initial: 10_000 });
    const id = await addRecurring(app, bank, { amountMinor: 700, note: 'Gym' });
    const yesterday = toDateKey(Date.now() - 36 * 3_600_000);
    // Make the rule due, as if the app had not run since yesterday.
    app.container.db.runSync(
      `UPDATE recurring_transactions SET start_date = ?, next_date = ? WHERE id = ?`,
      [yesterday, yesterday, id],
    );

    await renderWithApp(<FinanceBridge />, app);
    await waitFor(async () =>
      expect(
        (await app.finance.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 10)).length,
      ).toBeGreaterThanOrEqual(1),
    );
    expect((await app.finance.accounts.list())[0]?.balanceMinor).toBeLessThan(10_000);
  });

  it('does nothing when nothing is due', async () => {
    const app = createApp();
    const spy = jest.spyOn(app.finance.recurring, 'postDue');
    await renderWithApp(<FinanceBridge />, app);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(await app.finance.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 10)).toHaveLength(0);
  });
});
