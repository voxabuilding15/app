import { EmptyState, Screen } from '@/components';

export function PomodoroScreen() {
  return (
    <Screen>
      <EmptyState
        icon="timer"
        title="Ready to focus"
        message="Focus sessions and breaks will be timed here, and your focus hours tracked."
      />
    </Screen>
  );
}
