import { useLocalSearchParams } from 'expo-router';

import { TransactionFormScreen } from '@/features/finance';

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <TransactionFormScreen key={id} transactionId={id} defaults={{ type: null, accountId: null }} />
  );
}
