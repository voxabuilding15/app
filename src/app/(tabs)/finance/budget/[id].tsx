import { useLocalSearchParams } from 'expo-router';

import { BudgetFormScreen } from '@/features/finance';

export default function EditBudgetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BudgetFormScreen key={id} budgetId={id} />;
}
