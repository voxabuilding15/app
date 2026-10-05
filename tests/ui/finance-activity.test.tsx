import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FinanceScreen } from '@/features/finance/presentation/screens/FinanceScreen';

import {
  addAccount,
  addBudget,
  addCategory,
  addRecurring,
  addTransaction,
  refresh,
} from './finance-seed';
import { createApp, renderWithApp, router } from './harness';

const row = (pattern: RegExp) => screen.getByLabelText(pattern);
const gone = (pattern: RegExp) =>
  waitFor(() => expect(screen.queryByLabelText(pattern)).toBeNull());

describe('FinanceScreen: activity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for an account first when there are none', async () => {
    await renderWithApp(<FinanceScreen />);
    expect(await screen.findByText('Add an account first')).toBeTruthy();
    // The floating button leads to accounts rather than a form that cannot be saved.
    await fireEvent.press(screen.getByLabelText('Add transaction'));
    expect(await screen.findByText('No accounts yet')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows an empty state with a working add action once an account exists', async () => {
    const app = createApp();
    await addAccount(app, 'Bank');
    await renderWithApp(<FinanceScreen />, app);
    expect(await screen.findByText('No transactions yet')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Add transaction')[0]!);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/finance/transaction/new', params: {} });
  });

  it('lists transactions with signed amounts and this month at a glance', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank', { initial: 100_000 });
    const food = await addCategory(app, 'Groceries');
    await addTransaction(app, bank, { amountMinor: 2_550, categoryId: food, note: 'Weekly shop' });
    await addTransaction(app, bank, { type: 'income', amountMinor: 50_000, note: 'Pay' });
    await renderWithApp(<FinanceScreen />, app);

    expect(await screen.findByText('Groceries')).toBeTruthy();
    expect(screen.getByText('-$25.50')).toBeTruthy();
    expect(screen.getByText('+$500.00')).toBeTruthy();
    expect(screen.getByLabelText(/^Balance: \$1,474\.50/)).toBeTruthy();
    expect(screen.getByLabelText(/^Income: \$500\.00/)).toBeTruthy();
    expect(screen.getByLabelText(/^Spent: \$25\.50/)).toBeTruthy();
    expect(row(/^Expense \$25\.50, Groceries, Bank/)).toBeTruthy();
  });

  it('opens a transaction when pressed', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const id = await addTransaction(app, bank, { note: 'Coffee' });
    await renderWithApp(<FinanceScreen />, app);
    await fireEvent.press(await screen.findByLabelText(/^Expense \$10\.00/));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/finance/transaction/[id]',
      params: { id },
    });
  });

  it('searches notes, categories and accounts', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const cash = await addAccount(app, 'Cash wallet');
    await addTransaction(app, bank, { note: 'Pizza night' });
    await addTransaction(app, cash, { note: 'Bus ticket' });
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByLabelText(/Pizza night/);

    await fireEvent.press(screen.getByLabelText('Search'));
    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'wallet');
    expect(await screen.findByLabelText(/Bus ticket/)).toBeTruthy();
    await gone(/Pizza night/);

    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'zzz');
    expect(await screen.findByText('No matching transactions')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Clear search and filters'));
    expect(await screen.findByLabelText(/Pizza night/)).toBeTruthy();
  });

  it('filters by type, account, category and date', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    const cash = await addAccount(app, 'Cash');
    const food = await addCategory(app, 'Food');
    await addTransaction(app, bank, { note: 'Lunch', categoryId: food });
    await addTransaction(app, cash, { note: 'Taxi' });
    await addTransaction(app, bank, { type: 'income', note: 'Refund', amountMinor: 500 });
    await addTransaction(app, bank, { note: 'Old', occurredAt: new Date(2020, 0, 5).getTime() });
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByLabelText(/Lunch/);

    await fireEvent.press(screen.getByLabelText('Filter'));
    await fireEvent.press(await screen.findByLabelText('Income'));
    await waitFor(() => expect(screen.queryByLabelText(/Lunch/)).toBeNull());
    expect(screen.getByLabelText(/Refund/)).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Income')[0]!); // off again
    await fireEvent.press(screen.getByLabelText('This month'));
    await waitFor(() => expect(screen.queryByLabelText(/Old/)).toBeNull());
    await fireEvent.press(screen.getByLabelText('Cash'));
    await waitFor(() => expect(screen.queryByLabelText(/Lunch/)).toBeNull());
    expect(screen.getByLabelText(/Taxi/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reset'));
    await fireEvent.press(screen.getByLabelText('Food'));
    await waitFor(() => expect(screen.queryByLabelText(/Taxi/)).toBeNull());
    expect(screen.getByLabelText(/Lunch/)).toBeTruthy();
  });

  it('sorts by amount', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addTransaction(app, bank, { amountMinor: 100, note: 'Small' });
    await addTransaction(app, bank, { amountMinor: 900, note: 'Large' });
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByLabelText(/Small/);

    const order = () =>
      screen
        .getAllByLabelText(/^Expense /)
        .map((node) => String(node.props.accessibilityLabel).match(/\$(\d+\.\d+)/)?.[1]);

    await fireEvent.press(screen.getByLabelText(/^Sort by Date/));
    await fireEvent.press(await screen.findByLabelText('Amount'));
    await fireEvent.press(screen.getByLabelText('Descending'));
    await waitFor(() => expect(order()).toEqual(['9.00', '1.00']));
    await fireEvent.press(screen.getByLabelText('Ascending'));
    await waitFor(() => expect(order()).toEqual(['1.00', '9.00']));
  });

  it('deletes by swipe and brings the transaction back with Undo', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank', { initial: 5_000 });
    await addTransaction(app, bank, { amountMinor: 1_200, note: 'Dinner' });
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByLabelText(/Dinner/);

    await fireEvent.press(screen.getByLabelText('Delete'));
    expect(await screen.findByText('Transaction deleted')).toBeTruthy();
    await gone(/Dinner/);
    expect((await app.finance.accounts.list())[0]?.balanceMinor).toBe(5_000);

    await fireEvent.press(screen.getByLabelText('Undo'));
    expect(await screen.findByLabelText(/Dinner/)).toBeTruthy();
    expect((await app.finance.accounts.list())[0]?.balanceMinor).toBe(3_800);
  });

  it('duplicates a transaction and offers to edit the copy', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addTransaction(app, bank, { note: 'Coffee' });
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByLabelText(/Coffee/);

    await fireEvent.press(screen.getByLabelText('Duplicate'));
    expect(await screen.findByText('Transaction duplicated')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByLabelText(/Coffee/)).toHaveLength(2));
    await fireEvent.press(screen.getByLabelText('Edit'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/finance/transaction/[id]' }),
    );
  });

  it('offers the same actions to screen readers', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addTransaction(app, bank, { note: 'Coffee' });
    await renderWithApp(<FinanceScreen />, app);
    const item = await screen.findByLabelText(/Coffee/);
    expect(item.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'duplicate',
      'delete',
    ]);
    await fireEvent(item, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(await screen.findByText('Transaction deleted')).toBeTruthy();
  });

  it('refreshes when data changes elsewhere', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await renderWithApp(<FinanceScreen />, app);
    await screen.findByText('No transactions yet');
    await addTransaction(app, bank, { note: 'Late arrival' });
    await refresh(app);
    expect(await screen.findByLabelText(/Late arrival/)).toBeTruthy();
  });

  it('switches between the tabs and keeps each one working', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addBudget(app);
    await addRecurring(app, bank);
    await renderWithApp(<FinanceScreen />, app);

    await fireEvent.press(await screen.findByLabelText('Budgets'));
    expect(await screen.findByLabelText(/^Monthly, monthly budget/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Recurring'));
    expect(await screen.findByLabelText(/^Expense \$9\.00, Rent/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Stats'));
    expect(await screen.findByText('Income vs expenses')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Accounts'));
    expect(await screen.findByLabelText(/^Bank, Bank, balance/)).toBeTruthy();
    await act(async () => undefined);
  });

  it('opens the category manager', async () => {
    await renderWithApp(<FinanceScreen />);
    await fireEvent.press(await screen.findByLabelText('Manage categories'));
    expect(router.push).toHaveBeenCalledWith('/finance/categories');
  });
});
