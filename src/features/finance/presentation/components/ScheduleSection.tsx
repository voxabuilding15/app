import { View } from 'react-native';

import { Chip, FormSection, Text, WRAP_ROW } from '@/components';
import type { DateKey } from '@/core';
import { useTranslator } from '@/i18n';

import { formatDayKey } from '../format';

interface ScheduleSectionProps {
  startDate: DateKey;
  endDate: DateKey | null;
  error?: string;
  /** The start date is in the past, so earlier occurrences will be added right away. */
  backfills: boolean;
  onPickStart: () => void;
  onPickEnd: () => void;
  onEnds: (ends: 'never' | 'date') => void;
}

/** First day of a recurring transaction and the optional day it stops. */
export function ScheduleSection({
  startDate,
  endDate,
  error,
  backfills,
  onPickStart,
  onPickEnd,
  onEnds,
}: ScheduleSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Schedule')} error={error}>
      <View style={WRAP_ROW}>
        <Chip
          icon="event"
          label={t('Starts {dayKey}', { dayKey: formatDayKey(startDate) })}
          accessibilityLabel={t('Starts {dayKey}. Change', { dayKey: formatDayKey(startDate) })}
          onPress={onPickStart}
        />
      </View>
      <View style={WRAP_ROW}>
        <Chip label={t('Never ends')} selected={endDate === null} onPress={() => onEnds('never')} />
        <Chip
          label={t('Ends on a date')}
          selected={endDate !== null}
          onPress={() => onEnds('date')}
        />
        {endDate !== null ? (
          <Chip
            icon="event"
            label={formatDayKey(endDate)}
            accessibilityLabel={t('Ends {dayKey}. Change', { dayKey: formatDayKey(endDate) })}
            onPress={onPickEnd}
          />
        ) : null}
      </View>
      <Text variant="labelSmall" tone="muted">
        {backfills
          ? t('This start date is in the past, so the transactions since then are added now.')
          : t('Added automatically on each date, at 9:00.')}
      </Text>
    </FormSection>
  );
}
