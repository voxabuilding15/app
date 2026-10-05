import { EmptyState, Screen } from '@/components';

export function CalendarScreen() {
  return (
    <Screen>
      <EmptyState
        icon="calendar-month"
        title="Nothing scheduled"
        message="Your tasks, habits and reminders will appear on the calendar by day, week and month."
      />
    </Screen>
  );
}
