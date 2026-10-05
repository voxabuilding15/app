import { EmptyState, Screen } from '@/components';

export function AchievementsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="emoji-events"
        title="No achievements yet"
        message="Badges you earn by building streaks and finishing tasks will be shown here."
      />
    </Screen>
  );
}
