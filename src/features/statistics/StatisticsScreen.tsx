import { EmptyState, Screen } from '@/components';

export function StatisticsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="bar-chart"
        title="No statistics yet"
        message="Completed tasks, focus hours, habits and spending will be charted here over time."
      />
    </Screen>
  );
}
