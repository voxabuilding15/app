import { EmptyState, Screen } from '@/components';

export function FinanceScreen() {
  return (
    <Screen>
      <EmptyState
        icon="account-balance-wallet"
        title="No transactions yet"
        message="Record income and expenses to see your balance, budget and spending by category."
      />
    </Screen>
  );
}
