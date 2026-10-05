import { useLocalSearchParams } from 'expo-router';

import { HabitDetailScreen } from '@/features/habits';

export default function HabitDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitDetailScreen key={id} habitId={id} />;
}
