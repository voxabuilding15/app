import { View } from 'react-native';

import { Button, NumberStepper, Sheet, Text } from '@/components';
import type { DateKey } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

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
  const { t } = useTranslator();
  const { count, skipped } = evaluator.dayLog(day);

  return (
    <Sheet visible title={formatRelativeDay(day, today)} onClose={onClose}>
      <Text tone="muted">
        {skipped
          ? t('This day is skipped, so it does not affect your streak.')
          : count === 0
            ? t('Nothing logged on this day.')
            : t('{count} logged on this day.', { count })}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text>{t('Completions of {name}', { name: habit.name })}</Text>
        <NumberStepper
          label={t('Completions on this day')}
          value={count}
          max={999}
          onChange={(value) => onAdjust(value - count)}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' }}>
        <Button
          label={skipped ? t('Unskip day') : t('Skip day')}
          variant="outlined"
          icon={skipped ? 'undo' : 'skip-next'}
          onPress={() => onSkip(!skipped)}
        />
        <Button label={t('Done')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
