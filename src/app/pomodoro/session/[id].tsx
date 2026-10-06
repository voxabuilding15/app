import { useLocalSearchParams } from 'expo-router';

import { SessionDetailsScreen } from '@/features/pomodoro';

export default function SessionDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetailsScreen key={id} id={id} />;
}
