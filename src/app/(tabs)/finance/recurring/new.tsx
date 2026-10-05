import { RecurringFormScreen } from '@/features/finance';

export default function NewRecurringRoute() {
  return <RecurringFormScreen recurringId={null} defaults={{ type: null }} />;
}
