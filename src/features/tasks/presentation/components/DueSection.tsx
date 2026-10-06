import { View } from 'react-native';

import { Button, Chip, FormSection, Text, WRAP_ROW } from '@/components';
import { useNow } from '@/hooks';
import { spacing } from '@/theme';

import { addDays, startOfDay } from '@/core';
import { useTranslator } from '@/i18n';
import type { DueDate } from '../../domain/entities';
import { formatDate, formatTime } from '../format';
import type { QuickDate } from '../view-models/useTaskFormViewModel';
import { msg } from '@/i18n/msg';

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
  { kind: 'today', label: msg('Today'), days: 0 },
  { kind: 'tomorrow', label: msg('Tomorrow'), days: 1 },
  { kind: 'nextWeek', label: msg('Next week'), days: 7 },
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
  const { t } = useTranslator();
  const now = useNow();
  const selectedDay = due === null ? null : startOfDay(due.at);
  const isQuick = QUICK.some((q) => selectedDay === addDays(startOfDay(now), q.days));

  return (
    <FormSection title={t('Due')} error={error}>
      <View style={WRAP_ROW}>
        {QUICK.map((q) => (
          <Chip
            key={q.kind}
            label={t(q.label)}
            selected={selectedDay === addDays(startOfDay(now), q.days)}
            onPress={() => onQuickDate(q.kind)}
          />
        ))}
        <Chip
          icon="event"
          label={due !== null && !isQuick ? formatDate(due.at, now, true) : t('Pick date')}
          selected={due !== null && !isQuick}
          onPress={onChooseDate}
        />
      </View>
      {due !== null ? (
        <View style={{ gap: spacing.sm }}>
          <View style={WRAP_ROW}>
            <Chip
              icon="schedule"
              label={due.hasTime ? formatTime(due.at) : t('Add time')}
              selected={due.hasTime}
              accessibilityLabel={
                due.hasTime
                  ? t('Due time {time}. Change', { time: formatTime(due.at) })
                  : t('Add due time')
              }
              onPress={onChooseTime}
            />
            {due.hasTime ? (
              <Chip icon="clear" label={t('Remove time')} onPress={onClearTime} />
            ) : null}
          </View>
          <Text variant="labelSmall" tone="muted">
            {due.hasTime ? t('Due at a specific time.') : t('Due any time that day.')}
          </Text>
          <Button label={t('Remove due date')} variant="text" icon="clear" onPress={onClear} />
        </View>
      ) : null}
    </FormSection>
  );
}
