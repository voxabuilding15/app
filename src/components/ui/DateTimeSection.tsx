import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip } from './Chip';
import { WRAP_ROW } from './ChipGroup';
import { FormSection } from './FormSection';
import { useTranslator } from '@/i18n';

interface DateTimeSectionProps {
  title: string;
  /** Text of the date chip, e.g. "Today". Null shows only the "add" chip (see `emptyLabel`). */
  dayLabel: string | null;
  timeLabel: string | null;
  error?: string;
  /** Label of the chip that sets a date when none is set. */
  emptyLabel?: string;
  onPickDay: () => void;
  onPickTime: () => void;
  /** Adds a chip that removes the date again. */
  onClear?: () => void;
  children?: ReactNode;
}

/** Date and time chips that open the system pickers, with an optional "no date" state. */
export function DateTimeSection({
  title,
  dayLabel,
  timeLabel,
  error,
  emptyLabel,
  onPickDay,
  onPickTime,
  onClear,
  children,
}: DateTimeSectionProps) {
  const { t } = useTranslator();
  return (
    <FormSection title={title} error={error}>
      <View style={WRAP_ROW}>
        {dayLabel === null || timeLabel === null ? (
          <Chip icon="event" label={emptyLabel ?? t('Add date')} onPress={onPickDay} />
        ) : (
          <>
            <Chip
              icon="event"
              label={dayLabel}
              accessibilityLabel={t('Date {value}. Change', { value: dayLabel })}
              onPress={onPickDay}
            />
            <Chip
              icon="schedule"
              label={timeLabel}
              accessibilityLabel={t('Time {value}. Change', { value: timeLabel })}
              onPress={onPickTime}
            />
            {onClear ? (
              <Chip
                icon="close"
                label={t('Remove')}
                accessibilityLabel={t('Remove date')}
                onPress={onClear}
              />
            ) : null}
          </>
        )}
      </View>
      {children}
    </FormSection>
  );
}
