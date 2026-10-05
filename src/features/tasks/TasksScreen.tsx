import { EmptyFeatureScreen } from '../shared/EmptyFeatureScreen';

export function TasksScreen() {
  return (
    <EmptyFeatureScreen
      icon="check-circle"
      title="No tasks yet"
      message="Tasks you create will appear here with their priority, due date and reminders."
    />
  );
}
