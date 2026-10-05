import { EmptyState, Screen } from '@/components';

export function HabitsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="local-fire-department"
        title="No habits yet"
        message="Build a routine by adding a habit. Your streaks and progress will show up here."
      />
    </Screen>
  );
}
