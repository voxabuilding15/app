import { useLocalSearchParams } from 'expo-router';

import { TransactionFormScreen } from '@/features/finance';

const TYPES = ['expense', 'income', 'transfer'] as const;

export default function NewTransactionRoute() {
  const { type, accountId } = useLocalSearchParams<{ type?: string; accountId?: string }>();
  return (
    <TransactionFormScreen
      transactionId={null}
      defaults={{
        type: TYPES.find((candidate) => candidate === type) ?? null,
        accountId: accountId ?? null,
      }}
    />
  );
}
