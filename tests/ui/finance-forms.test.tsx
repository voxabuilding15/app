import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { addDaysToKey, toDateKey } from '@/core';
import { DEFAULT_FILTER, DEFAULT_SORT } from '@/features/finance/domain/filters';
import { BudgetFormScreen } from '@/features/finance/presentation/screens/BudgetFormScreen';
import { RecurringFormScreen } from '@/features/finance/presentation/screens/RecurringFormScreen';
import { TransactionFormScreen } from '@/features/finance/presentation/screens/TransactionFormScreen';

import { addAccount, addBudget, addCategory, addRecurring, addTransaction } from './finance-seed';
import { createApp, renderWithApp, router, type TestApp } from './harness';

const openPicker = DateTimePickerAndroid.open as jest.Mock;

function pickerReturns(date: Date) {
  openPicker.mockImplementation(({ onChange }: { onChange: (e: object, d?: Date) => void }) =>
    onChange({ type: 'set' }, date),
  );
}

const NEW_TRANSACTION = { type: null, accountId: null } as const;
const allTransactions = (app: TestApp) =>
  app.finance.transactions.list(DEFAULT_FILTER, DEFAULT_SORT, 50);

function answerAlert(button: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((candidate) => candidate.text === button)?.onPress?.();
  });
}

describe('TransactionFormScreen (create)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('asks for an account first when there are none', async () => {
    await renderWithApp(<TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />);
    expect(await screen.findByText('Add an account first')).toBeTruthy();
  });

  it('explains what is missing and what cannot be read', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );

    await fireEvent.press(await screen.findByLabelText('Add transaction'));
    expect(await screen.findByText('Enter an amount greater than zero')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText(/^Amount/), 'abc');
    expect(await screen.findByText('Enter a valid amount')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), '12.5');
    await waitFor(() => expect(screen.queryByText('Enter a valid amount')).toBeNull());
    expect(await allTransactions(app)).toHaveLength(0);
  });

  it('records an expense with a category, a note and the chosen account', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    const second = await addAccount(app, 'Second');
    const food = await addCategory(app, 'Food');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );

    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '12,50');
    await fireEvent.changeText(screen.getByLabelText('Note'), '  Lunch with Sam ');
    await fireEvent.press(screen.getByLabelText('Second, Bank'));
    await fireEvent.press(screen.getByLabelText('Food'));
    await fireEvent.press(screen.getByLabelText('Add transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await allTransactions(app);
    expect(saved).toMatchObject({
      type: 'expense',
      amountMinor: 1250,
      note: 'Lunch with Sam',
      account: { id: second, name: 'Second' },
      category: { id: food, name: 'Food' },
    });
    expect((await app.finance.accounts.list())[1]?.balanceMinor).toBe(-1250);
  });

  it('starts on the account and type it was opened for', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    const second = await addAccount(app, 'Second');
    await renderWithApp(
      <TransactionFormScreen
        transactionId={null}
        defaults={{ type: 'income', accountId: second }}
      />,
      app,
    );
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '40');
    await fireEvent.press(screen.getByLabelText('Add transaction'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await allTransactions(app))[0]).toMatchObject({
      type: 'income',
      account: { id: second },
    });
  });

  it('uses the picked date and time', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '5');

    pickerReturns(new Date(2030, 4, 17, 0, 0));
    await fireEvent.press(screen.getByLabelText(/^Date .*Change$/));
    pickerReturns(new Date(2000, 0, 1, 18, 45));
    await fireEvent.press(screen.getByLabelText(/^Time .*Change$/));
    expect(await screen.findByLabelText(/^Time 6:45 PM/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await allTransactions(app))[0]?.occurredAt).toBe(
      new Date(2030, 4, 17, 18, 45).getTime(),
    );
  });

  it('moves money between accounts without a category, and never to the same account', async () => {
    const app = createApp();
    const main = await addAccount(app, 'Main', { initial: 10_000 });
    const savings = await addAccount(app, 'Savings', { type: 'savings' });
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );

    await fireEvent.press(await screen.findByLabelText('Transfer'));
    expect(screen.getByText('From')).toBeTruthy();
    expect(screen.getByText('To')).toBeTruthy();
    expect(screen.queryByText('Category')).toBeNull();
    expect(screen.queryByLabelText('Main, Bank')).not.toBeNull();
    // The destination list leaves out the source account.
    expect(screen.getAllByLabelText('Main, Bank')).toHaveLength(1);

    await fireEvent.changeText(screen.getByLabelText(/^Amount/), '25');
    await fireEvent.press(screen.getByLabelText('Add transaction'));
    expect(await screen.findByText('Choose the account to move money to')).toBeTruthy();
    // Savings is offered under both From and To; the second chip is the destination.
    await fireEvent.press(screen.getAllByLabelText('Savings, Savings')[1]!);
    await fireEvent.press(screen.getByLabelText('Add transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await allTransactions(app))[0]).toMatchObject({
      type: 'transfer',
      toAccount: { id: savings },
    });
    const balances = await app.finance.accounts.list();
    expect([balances[0]?.id, balances[0]?.balanceMinor, balances[1]?.balanceMinor]).toEqual([
      main,
      7_500,
      2_500,
    ]);
  });

  it('drops the chosen category when the type changes, and offers the matching categories', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await addCategory(app, 'Food');
    await addCategory(app, 'Salary', 'income');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );

    await fireEvent.press(await screen.findByLabelText('Food'));
    expect(screen.getByLabelText('Food').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText('Salary')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Income'));
    expect(await screen.findByLabelText('Salary')).toBeTruthy();
    expect(screen.queryByLabelText('Food')).toBeNull();
    expect(screen.getByLabelText('None').props.accessibilityState.selected).toBe(true);
  });

  it('creates a category from inside the form and selects it', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );
    await fireEvent.press(await screen.findByLabelText('Create a category'));
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Coffee');
    await fireEvent.press(screen.getByLabelText('Save'));

    const chip = await screen.findByLabelText('Coffee');
    expect(chip.props.accessibilityState.selected).toBe(true);
    expect((await app.finance.expenseCategories.list()).map((c) => c.name)).toEqual(['Coffee']);
  });

  it('warns when an expense takes a budget over its limit', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await addBudget(app, { name: 'Tiny', amountMinor: 500 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '8');
    await fireEvent.press(screen.getByLabelText('Add transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith('Over budget', 'Tiny: over by $3.00');
  });

  it('keeps an archived account out of the choices', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    const old = await addAccount(app, 'Retired');
    await app.finance.accounts.setArchived(old, true);
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={NEW_TRANSACTION} />,
      app,
    );
    await screen.findByLabelText('Main, Bank');
    expect(screen.queryByLabelText('Retired, Bank')).toBeNull();
  });
});

describe('TransactionFormScreen (edit)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('loads the transaction, saves changes and goes back', async () => {
    const app = createApp();
    const main = await addAccount(app, 'Main');
    const id = await addTransaction(app, main, { amountMinor: 2550, note: 'Shoes' });
    await renderWithApp(
      <TransactionFormScreen transactionId={id} defaults={NEW_TRANSACTION} />,
      app,
    );

    const amount = await screen.findByDisplayValue('25.5');
    expect(screen.getByDisplayValue('Shoes')).toBeTruthy();
    await fireEvent.changeText(amount, '30');
    await fireEvent.press(screen.getByLabelText('Save changes'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await allTransactions(app))[0]).toMatchObject({ id, amountMinor: 3000, note: 'Shoes' });
  });

  it('can switch an expense to income', async () => {
    const app = createApp();
    const main = await addAccount(app, 'Main', { initial: 1_000 });
    const id = await addTransaction(app, main, { amountMinor: 400 });
    await renderWithApp(
      <TransactionFormScreen transactionId={id} defaults={NEW_TRANSACTION} />,
      app,
    );
    await fireEvent.press(await screen.findByLabelText('Income'));
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.finance.accounts.list())[0]?.balanceMinor).toBe(1_400);
  });

  it('still edits a transaction on an archived account', async () => {
    const app = createApp();
    const old = await addAccount(app, 'Retired');
    const id = await addTransaction(app, old, { amountMinor: 100 });
    await app.finance.accounts.setArchived(old, true);
    await renderWithApp(
      <TransactionFormScreen transactionId={id} defaults={NEW_TRANSACTION} />,
      app,
    );
    await fireEvent.changeText(await screen.findByDisplayValue('1'), '2');
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await allTransactions(app))[0]?.amountMinor).toBe(200);
  });

  it('says when the transaction no longer exists', async () => {
    await renderWithApp(<TransactionFormScreen transactionId="ghost" defaults={NEW_TRANSACTION} />);
    expect(await screen.findByText('Transaction not found')).toBeTruthy();
  });

  it('asks before deleting', async () => {
    const app = createApp();
    const main = await addAccount(app, 'Main');
    const id = await addTransaction(app, main);
    await renderWithApp(
      <TransactionFormScreen transactionId={id} defaults={NEW_TRANSACTION} />,
      app,
    );
    await screen.findByDisplayValue('10');

    const alert = answerAlert('Delete');
    await fireEvent.press(screen.getByLabelText('Delete transaction'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await allTransactions(app)).toHaveLength(0);
  });
});

describe('BudgetFormScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('explains problems before saving', async () => {
    const app = createApp();
    await renderWithApp(<BudgetFormScreen budgetId={null} />, app);
    await fireEvent.press(await screen.findByLabelText('Create budget'));
    expect(await screen.findByText('Enter a name')).toBeTruthy();
    expect(screen.getByText('Enter an amount greater than zero')).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
    expect(await app.finance.budgets.list()).toHaveLength(0);
  });

  it('creates a monthly budget limited to categories', async () => {
    const app = createApp();
    const food = await addCategory(app, 'Food');
    await addCategory(app, 'Fun');
    await renderWithApp(<BudgetFormScreen budgetId={null} />, app);

    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Eating out');
    await fireEvent.changeText(screen.getByLabelText(/^Limit/), '250');
    await fireEvent.press(screen.getByLabelText('Food'));
    expect(screen.getByLabelText('All spending').props.accessibilityState.selected).toBe(false);
    await fireEvent.press(screen.getByLabelText('Create budget'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [saved] = await app.finance.budgets.list();
    expect(saved?.budget).toMatchObject({
      name: 'Eating out',
      period: 'monthly',
      amountMinor: 25_000,
      categoryIds: [food],
    });
  });

  it('creates a weekly budget covering all spending', async () => {
    const app = createApp();
    await renderWithApp(<BudgetFormScreen budgetId={null} />, app);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Weekly');
    await fireEvent.changeText(screen.getByLabelText(/^Limit/), '80.5');
    await fireEvent.press(screen.getByLabelText('Weekly'));
    expect(screen.getByText('Starts over every Monday.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Create budget'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.finance.budgets.list())[0]?.budget).toMatchObject({
      period: 'weekly',
      amountMinor: 8_050,
      categoryIds: [],
    });
  });

  it('creates a custom budget with picked dates and rejects an end before the start', async () => {
    const app = createApp();
    await renderWithApp(<BudgetFormScreen budgetId={null} />, app);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Trip');
    await fireEvent.changeText(screen.getByLabelText(/^Limit/), '900');
    await fireEvent.press(screen.getByLabelText('Custom'));

    pickerReturns(new Date(2031, 5, 20, 12));
    await fireEvent.press(screen.getByLabelText(/^Starts .*Change$/));
    pickerReturns(new Date(2031, 5, 10, 12));
    await fireEvent.press(screen.getByLabelText(/^Ends .*Change$/));
    await fireEvent.press(screen.getByLabelText('Create budget'));
    expect(await screen.findByText('The end date cannot be before the start date')).toBeTruthy();

    pickerReturns(new Date(2031, 5, 27, 12));
    await fireEvent.press(screen.getByLabelText(/^Ends .*Change$/));
    await waitFor(() =>
      expect(screen.queryByText('The end date cannot be before the start date')).toBeNull(),
    );
    await fireEvent.press(screen.getByLabelText('Create budget'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.finance.budgets.list())[0]?.budget).toMatchObject({
      period: 'custom',
      startDate: '2031-06-20',
      endDate: '2031-06-27',
    });
  });

  it('rejects a name that is already used', async () => {
    const app = createApp();
    await addBudget(app, { name: 'Groceries' });
    await renderWithApp(<BudgetFormScreen budgetId={null} />, app);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'groceries');
    await fireEvent.changeText(screen.getByLabelText(/^Limit/), '10');
    await fireEvent.press(screen.getByLabelText('Create budget'));
    expect(await screen.findByText('This name is already in use')).toBeTruthy();
  });

  it('loads, edits and deletes a budget', async () => {
    const app = createApp();
    const id = await addBudget(app, { name: 'Fun', amountMinor: 12_345 });
    await renderWithApp(<BudgetFormScreen budgetId={id} />, app);
    await fireEvent.changeText(await screen.findByDisplayValue('123.45'), '200');
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.finance.budgets.get(id))?.amountMinor).toBe(20_000);

    jest.clearAllMocks();
    await renderWithApp(<BudgetFormScreen budgetId={id} />, app);
    await screen.findAllByDisplayValue('200');
    answerAlert('Delete');
    await fireEvent.press(screen.getAllByLabelText('Delete budget')[0]!);
    await waitFor(async () => expect(await app.finance.budgets.get(id)).toBeNull());
  });

  it('says when the budget no longer exists', async () => {
    await renderWithApp(<BudgetFormScreen budgetId="ghost" />);
    expect(await screen.findByText('Budget not found')).toBeTruthy();
  });
});

describe('RecurringFormScreen', () => {
  const NEW = { type: null } as const;
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('asks for an account first when there are none', async () => {
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />);
    expect(await screen.findByText('Add an account first')).toBeTruthy();
  });

  it('explains what is missing', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('Add recurring transaction'));
    expect(await screen.findByText('Enter an amount greater than zero')).toBeTruthy();
    expect(await app.finance.recurring.list()).toHaveLength(0);
  });

  it('creates a monthly rule starting today and records the first transaction at once', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />, app);
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '1200');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Rent');
    expect(screen.getByText(/Added automatically on each date, at 9:00/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add recurring transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [rule] = await app.finance.recurring.list();
    expect(rule).toMatchObject({
      amountMinor: 120_000,
      note: 'Rent',
      rule: { unit: 'month', interval: 1 },
    });
    expect(await allTransactions(app)).toHaveLength(1);
    expect((await allTransactions(app))[0]?.recurringId).toBe(rule?.id);
  });

  it('offers the repeat presets, a custom interval and an end date', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />, app);
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '5');

    await fireEvent.press(screen.getByLabelText('Weekly'));
    expect(screen.getByLabelText('Weekly').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText('Custom'));
    await fireEvent.press(screen.getByLabelText('Ends on a date'));
    pickerReturns(new Date(2099, 11, 31, 12));
    await fireEvent.press(screen.getByLabelText(/^Ends .*Change$/));
    pickerReturns(new Date(2099, 0, 1, 12));
    await fireEvent.press(screen.getByLabelText(/^Starts .*Change$/));
    await fireEvent.press(screen.getByLabelText('Add recurring transaction'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const [rule] = await app.finance.recurring.list();
    expect(rule?.rule.unit).toBe('day');
    expect(rule?.rule.interval).toBe(2);
    expect(rule?.startDate).toBe('2099-01-01');
    expect(rule?.endDate).toBe('2099-12-31');
    expect(await allTransactions(app)).toHaveLength(0);
  });

  it('warns that a past start date adds the missed transactions', async () => {
    const app = createApp();
    await addAccount(app, 'Main');
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />, app);
    await fireEvent.changeText(await screen.findByLabelText(/^Amount/), '5');
    await fireEvent.press(screen.getByLabelText('Daily'));
    const start = addDaysToKey(toDateKey(Date.now()), -2);
    const [y, m, d] = start.split('-').map(Number);
    pickerReturns(new Date(y!, m! - 1, d!, 12));
    await fireEvent.press(screen.getByLabelText(/^Starts .*Change$/));
    expect(
      await screen.findByText(/in the past, so the transactions since then are added now/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add recurring transaction'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await allTransactions(app)).toHaveLength(3);
  });

  it('creates a transfer rule', async () => {
    const app = createApp();
    await addAccount(app, 'Main', { initial: 10_000 });
    await addAccount(app, 'Savings', { type: 'savings' });
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={NEW} />, app);
    await fireEvent.press(await screen.findByLabelText('Transfer'));
    await fireEvent.changeText(screen.getByLabelText(/^Amount/), '100');
    // Savings is offered under both From and To; the second chip is the destination.
    await fireEvent.press(screen.getAllByLabelText('Savings, Savings')[1]!);
    await fireEvent.press(screen.getByLabelText('Add recurring transaction'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const balances = await app.finance.accounts.list();
    expect([balances[0]?.balanceMinor, balances[1]?.balanceMinor]).toEqual([0, 10_000]);
  });

  it('loads, edits and deletes a rule', async () => {
    const app = createApp();
    const main = await addAccount(app, 'Main');
    const id = await addRecurring(app, main, { note: 'Gym', amountMinor: 3_000 });
    await renderWithApp(<RecurringFormScreen recurringId={id} defaults={NEW} />, app);

    await fireEvent.changeText(await screen.findByDisplayValue('30'), '35');
    await fireEvent.press(screen.getByLabelText('Save changes'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect((await app.finance.recurring.get(id))?.amountMinor).toBe(3_500);

    jest.clearAllMocks();
    await renderWithApp(<RecurringFormScreen recurringId={id} defaults={NEW} />, app);
    await screen.findAllByDisplayValue('35');
    answerAlert('Delete');
    await fireEvent.press(screen.getAllByLabelText('Delete recurring transaction')[0]!);
    await waitFor(async () => expect(await app.finance.recurring.get(id)).toBeNull());
  });

  it('says when the rule no longer exists', async () => {
    await renderWithApp(<RecurringFormScreen recurringId="ghost" defaults={NEW} />);
    expect(await screen.findByText('Not found')).toBeTruthy();
  });
});
