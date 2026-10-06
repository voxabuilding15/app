import { fireEvent, screen } from '@testing-library/react-native';

import { BudgetFormScreen } from '@/features/finance/presentation/screens/BudgetFormScreen';
import { FinanceScreen } from '@/features/finance/presentation/screens/FinanceScreen';
import { RecurringFormScreen } from '@/features/finance/presentation/screens/RecurringFormScreen';
import { TransactionFormScreen } from '@/features/finance/presentation/screens/TransactionFormScreen';

import { addAccount, addBudget, addRecurring, addTransaction } from './finance-seed';
import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1100, height: 800, scale: 2, fontScale: 1 }),
}));

type Json = ReturnType<typeof screen.toJSON>;

function styleOf(node: unknown): Record<string, unknown> {
  const style = (node as { props?: { style?: unknown } }).props?.style;
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function countNodes(tree: Json, predicate: (node: unknown) => boolean): number {
  const nodes = Array.isArray(tree) ? tree : tree === null ? [] : [tree];
  return nodes.reduce<number>((total, node) => {
    const children = (node as { children?: unknown[] | null }).children ?? [];
    const nested = children.filter((child) => typeof child === 'object') as Json[];
    return total + (predicate(node) ? 1 : 0) + countNodes(nested as unknown as Json, predicate);
  }, 0);
}

const halfWidthCells = () =>
  countNodes(screen.toJSON(), (node) => styleOf(node).maxWidth === '50%');

describe('finance tablet layout (1100 x 800)', () => {
  it('lays transactions out in two columns', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    for (const note of ['One', 'Two', 'Three']) {
      await addTransaction(app, bank, { note });
    }
    await renderWithApp(<FinanceScreen />, app);
    expect(await screen.findByLabelText(/Three/)).toBeTruthy();
    expect(halfWidthCells()).toBe(3);
  });

  it('lays budgets, accounts and recurring transactions out in two columns', async () => {
    const app = createApp();
    const bank = await addAccount(app, 'Bank');
    await addAccount(app, 'Cash');
    await addBudget(app, { name: 'A' });
    await addBudget(app, { name: 'B' });
    await addRecurring(app, bank);
    await renderWithApp(<FinanceScreen />, app);

    await fireEvent.press(await screen.findByLabelText('Accounts'));
    await screen.findByLabelText(/^Cash/);
    expect(halfWidthCells()).toBe(2);
    await fireEvent.press(screen.getByLabelText('Budgets'));
    await screen.findByLabelText(/^A, Monthly/);
    expect(halfWidthCells()).toBe(2);
    await fireEvent.press(screen.getByLabelText('Recurring'));
    await screen.findByLabelText(/^Expense \$9\.00/);
    expect(halfWidthCells()).toBe(1);
  });

  it('shows every statistics card, side by side', async () => {
    await renderWithApp(<FinanceScreen />);
    await fireEvent.press(await screen.findByLabelText('Stats'));
    for (const title of ['Income vs expenses', 'Cashflow', 'By category']) {
      expect(await screen.findByText(title)).toBeTruthy();
    }
    expect(screen.getByText('Biggest changes in spending')).toBeTruthy();
  });

  it('renders every transaction form section without losing any', async () => {
    const app = createApp();
    await addAccount(app, 'Bank');
    await renderWithApp(
      <TransactionFormScreen transactionId={null} defaults={{ type: null, accountId: null }} />,
      app,
    );
    for (const section of ['Details', 'Account', 'Category', 'Date and time']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
  });

  it('renders every budget form section without losing any', async () => {
    await renderWithApp(<BudgetFormScreen budgetId={null} />);
    for (const section of ['Details', 'Period', 'Spending it covers']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
  });

  it('renders every recurring form section without losing any', async () => {
    const app = createApp();
    await addAccount(app, 'Bank');
    await renderWithApp(<RecurringFormScreen recurringId={null} defaults={{ type: null }} />, app);
    for (const section of ['Details', 'Repeat', 'Schedule']) {
      expect(await screen.findByText(section)).toBeTruthy();
    }
  });
});
