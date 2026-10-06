import { View } from 'react-native';

import { Chip, FormSection, SegmentedControl, Text, WRAP_ROW } from '@/components';
import type { DateKey } from '@/core';
import { useTranslator } from '@/i18n';

import { BUDGET_PERIODS, type BudgetPeriod } from '../../domain/entities';
import { BUDGET_PERIOD_LABEL, formatDayKey } from '../format';
import { msg } from '@/i18n/msg';
import { translatedLabels } from '@/i18n/labels';

const PERIOD_OPTIONS = BUDGET_PERIODS.map((value) => ({
  value,
  label: BUDGET_PERIOD_LABEL[value],
}));

const PERIOD_HINT: Record<BudgetPeriod, string> = translatedLabels({
  monthly: msg('Starts over on the first of every month.'),
  weekly: msg('Starts over every Monday.'),
  custom: msg('Covers the dates you choose, such as a trip or a project.'),
});

interface BudgetPeriodSectionProps {
  period: BudgetPeriod;
  startDate: DateKey | null;
  endDate: DateKey | null;
  error?: string;
  onPeriod: (period: BudgetPeriod) => void;
  onPickStart: () => void;
  onPickEnd: () => void;
}

export function BudgetPeriodSection({
  period,
  startDate,
  endDate,
  error,
  onPeriod,
  onPickStart,
  onPickEnd,
}: BudgetPeriodSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Period')} error={error}>
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={onPeriod} />
      {period === 'custom' && startDate !== null && endDate !== null ? (
        <View style={WRAP_ROW}>
          <Chip
            icon="event"
            label={t('From {dayKey}', { dayKey: formatDayKey(startDate) })}
            accessibilityLabel={t('Starts {dayKey}. Change', { dayKey: formatDayKey(startDate) })}
            onPress={onPickStart}
          />
          <Chip
            icon="event"
            label={`To ${formatDayKey(endDate)}`}
            accessibilityLabel={t('Ends {dayKey}. Change', { dayKey: formatDayKey(endDate) })}
            onPress={onPickEnd}
          />
        </View>
      ) : null}
      <Text variant="labelSmall" tone="muted">
        {PERIOD_HINT[period]}
      </Text>
    </FormSection>
  );
}
