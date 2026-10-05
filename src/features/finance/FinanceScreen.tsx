import { EmptyFeatureScreen } from '../shared/EmptyFeatureScreen';

export function FinanceScreen() {
  return (
    <EmptyFeatureScreen
      icon="account-balance-wallet"
      title="No transactions yet"
      message="Record income and expenses to see your balance, budget and spending by category."
    />
  );
}
