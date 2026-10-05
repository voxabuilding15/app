import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen } from '@/features/calendar';

export default function NewEventRoute() {
  const { day, minutes } = useLocalSearchParams<{ day?: string; minutes?: string }>();
  const parsed = minutes === undefined ? Number.NaN : Number(minutes);
  return (
    <EventFormScreen
      eventId={null}
      occurrenceDate={null}
      defaults={{
        day: day === undefined ? null : day,
        minutes: Number.isFinite(parsed) ? parsed : null,
      }}
    />
  );
}
