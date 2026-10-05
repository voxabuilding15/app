import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen } from '@/features/calendar';

export default function EditEventRoute() {
  const { id, occurrence } = useLocalSearchParams<{ id: string; occurrence?: string }>();
  return (
    <EventFormScreen
      key={`${id}:${occurrence ?? ''}`}
      eventId={id}
      occurrenceDate={occurrence === undefined ? null : occurrence}
      defaults={{ day: null, minutes: null }}
    />
  );
}
