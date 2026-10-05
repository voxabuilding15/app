import { EmptyFeatureScreen } from '../shared/EmptyFeatureScreen';

export function CalendarScreen() {
  return (
    <EmptyFeatureScreen
      icon="calendar-month"
      title="Nothing scheduled"
      message="Your tasks, habits and reminders will appear on the calendar by day, week and month."
    />
  );
}
