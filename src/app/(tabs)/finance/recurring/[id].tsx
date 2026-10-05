import { useLocalSearchParams } from 'expo-router';

import { RecurringFormScreen } from '@/features/finance';

export default function EditRecurringRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecurringFormScreen key={id} recurringId={id} defaults={{ type: null }} />;
}
