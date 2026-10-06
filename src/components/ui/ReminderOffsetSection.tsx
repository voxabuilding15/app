import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';
import { useTranslator } from '@/i18n';
import { currentTranslator } from '@/i18n/translate';

const DAY_MINUTES = 24 * 60;

/** "5 min before", "1 hour before", "1 day before, 9:00" ... for a reminder offset. */
function describeLeadTime(offsetMinutes: number, timed: boolean, atLabel: string): string {
  const { t, tn } = currentTranslator();
  if (!timed) {
    if (offsetMinutes === 0) {
      return t('On the day, 9:00');
    }
    return tn(offsetMinutes / DAY_MINUTES, '{count} day before, 9:00', '{count} days before, 9:00');
  }
  if (offsetMinutes === 0) {
    return atLabel;
  }
  if (offsetMinutes === DAY_MINUTES) {
    return t('1 day before');
  }
  return offsetMinutes >= 60
    ? tn(offsetMinutes / 60, '{count} hour before', '{count} hours before')
    : tn(offsetMinutes, '{count} min before', '{count} min before');
}

interface ReminderOffsetSectionProps {
  /** Offsets (minutes before the start) to offer. */
  offsets: readonly number[];
  value: number | null;
  /** False for all-day items, which are reminded at 9:00. */
  timed: boolean;
  /** Label for a zero offset on timed items, e.g. "At start". */
  atLabel: string;
  error?: string;
  onChange: (offset: number | null) => void;
  /** Extra controls shown once a reminder is chosen. */
  children?: ReactNode;
}

/** Form section for choosing how long before something starts to be reminded. */
export function ReminderOffsetSection({
  offsets,
  value,
  timed,
  atLabel,
  error,
  onChange,
  children,
}: ReminderOffsetSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={t('Reminder')} error={error}>
      <View style={WRAP_ROW}>
        <Chip label={t('None')} selected={value === null} onPress={() => onChange(null)} />
        {offsets.map((offset) => (
          <Chip
            key={offset}
            label={describeLeadTime(offset, timed, atLabel)}
            selected={value === offset}
            onPress={() => onChange(offset)}
          />
        ))}
      </View>
      {value !== null ? children : null}
    </FormSection>
  );
}
