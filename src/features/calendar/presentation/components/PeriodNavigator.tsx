import { View } from 'react-native';

import { Button, IconButton, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { CalendarView } from '../../domain/views';

interface PeriodNavigatorProps {
  title: string;
  view: CalendarView;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

const UNIT: Record<CalendarView, string> = {
  month: 'month',
  week: 'week',
  day: 'day',
  agenda: 'days',
};

/** Title of the period shown with previous, next and "Today" controls. */
export function PeriodNavigator({
  title,
  view,
  onPrevious,
  onNext,
  onToday,
}: PeriodNavigatorProps) {
  const { t } = useTranslator();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
      }}
    >
      <IconButton
        icon="chevron-left"
        label={t('Previous {value}', { value: UNIT[view] })}
        onPress={onPrevious}
      />
      <Text
        variant="titleMedium"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'center' }}
      >
        {title}
      </Text>
      <IconButton
        icon="chevron-right"
        label={t('Next {value}', { value: UNIT[view] })}
        onPress={onNext}
      />
      <Button label={t('Today')} variant="tonal" onPress={onToday} />
    </View>
  );
}
