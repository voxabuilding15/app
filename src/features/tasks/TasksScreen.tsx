import { EmptyState, Screen } from '@/components';

export function TasksScreen() {
  return (
    <Screen>
      <EmptyState
        icon="check-circle"
        title="No tasks yet"
        message="Tasks you create will appear here with their priority, due date and reminders."
      />
    </Screen>
  );
}
