import { useLocalSearchParams } from 'expo-router';

import { HabitFormScreen } from '@/features/habits';

export default function EditHabitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitFormScreen key={id} habitId={id} />;
}
