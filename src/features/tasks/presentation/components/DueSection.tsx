import { View } from 'react-native';

import { Button, Chip, Text } from '@/components';
import { useNow } from '@/hooks';
import { spacing } from '@/theme';

import { addDays, startOfDay } from '../../domain/dates';
import type { DueDate } from '../../domain/entities';
import { formatDate, formatTime } from '../format';
import type { QuickDate } from '../view-models/useTaskFormViewModel';

import { FormSection, WRAP_ROW } from './FormSection';

interface DueSectionProps {
  due: DueDate | null;
  error?: string;
  onQuickDate: (kind: QuickDate) => void;
  onChooseDate: () => void;
  onChooseTime: () => void;
  onClearTime: () => void;
  onClear: () => void;
}

const QUICK: readonly { kind: QuickDate; label: string; days: number }[] = [
  { kind: 'today', label: 'Today', days: 0 },
  { kind: 'tomorrow', label: 'Tomorrow', days: 1 },
  { kind: 'nextWeek', label: 'Next week', days: 7 },
];

export function DueSection({
  due,
  error,
  onQuickDate,
  onChooseDate,
  onChooseTime,
  onClearTime,
  onClear,
}: DueSectionProps) {
  const now = useNow();
  const selectedDay = due === null ? null : startOfDay(due.at);
  const isQuick = QUICK.some((q) => selectedDay === addDays(startOfDay(now), q.days));

  return (
    <FormSection title="Due" error={error}>
      <View style={WRAP_ROW}>
        {QUICK.map((q) => (
          <Chip
            key={q.kind}
            label={q.label}
            selected={selectedDay === addDays(startOfDay(now), q.days)}
            onPress={() => onQuickDate(q.kind)}
          />
        ))}
        <Chip
          icon="event"
          label={due !== null && !isQuick ? formatDate(due.at, now, true) : 'Pick date'}
          selected={due !== null && !isQuick}
          onPress={onChooseDate}
        />
      </View>
      {due !== null ? (
        <View style={{ gap: spacing.sm }}>
          <View style={WRAP_ROW}>
            <Chip
              icon="schedule"
              label={due.hasTime ? formatTime(due.at) : 'Add time'}
              selected={due.hasTime}
              accessibilityLabel={
                due.hasTime ? `Due time ${formatTime(due.at)}. Change` : 'Add due time'
              }
              onPress={onChooseTime}
            />
            {due.hasTime ? <Chip icon="clear" label="Remove time" onPress={onClearTime} /> : null}
          </View>
          <Text variant="labelSmall" tone="muted">
            {due.hasTime ? 'Due at a specific time.' : 'Due any time that day.'}
          </Text>
          <Button label="Remove due date" variant="text" icon="clear" onPress={onClear} />
        </View>
      ) : null}
    </FormSection>
  );
}
