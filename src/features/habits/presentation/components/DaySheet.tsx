import { View } from 'react-native';

import { Button, NumberStepper, Sheet, Text } from '@/components';
import type { DateKey } from '@/core';
import { spacing } from '@/theme';

import type { Habit } from '../../domain/entities';
import type { HabitEvaluator } from '../../domain/progress';
import { formatRelativeDay } from '../format';

interface DaySheetProps {
  day: DateKey;
  today: DateKey;
  habit: Habit;
  evaluator: HabitEvaluator;
  onAdjust: (delta: number) => void;
  onSkip: (skipped: boolean) => void;
  onClose: () => void;
}

/** Review or correct a single day of history. */
export function DaySheet({
  day,
  today,
  habit,
  evaluator,
  onAdjust,
  onSkip,
  onClose,
}: DaySheetProps) {
  const { count, skipped } = evaluator.dayLog(day);

  return (
    <Sheet visible title={formatRelativeDay(day, today)} onClose={onClose}>
      <Text tone="muted">
        {skipped
          ? 'This day is skipped, so it does not affect your streak.'
          : count === 0
            ? 'Nothing logged on this day.'
            : `${count} logged on this day.`}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text>{`Completions of ${habit.name}`}</Text>
        <NumberStepper
          label="Completions on this day"
          value={count}
          max={999}
          onChange={(value) => onAdjust(value - count)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button
          label={skipped ? 'Unskip day' : 'Skip day'}
          variant="outlined"
          icon={skipped ? 'undo' : 'skip-next'}
          onPress={() => onSkip(!skipped)}
        />
        <Button label="Done" onPress={onClose} />
      </View>
    </Sheet>
  );
}
