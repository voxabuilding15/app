import { View } from 'react-native';

import { Button, IconButton, Text } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';
import { msg } from '@/i18n/msg';

import type { CalendarView } from '../../domain/views';

interface PeriodNavigatorProps {
  title: string;
  view: CalendarView;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

const PREVIOUS: Record<CalendarView, string> = {
  month: msg('Previous month'),
  week: msg('Previous week'),
  day: msg('Previous day'),
  agenda: msg('Previous days'),
};

const NEXT: Record<CalendarView, string> = {
  month: msg('Next month'),
  week: msg('Next week'),
  day: msg('Next day'),
  agenda: msg('Next days'),
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
      <IconButton icon="chevron-left" label={t(PREVIOUS[view])} onPress={onPrevious} />
      <Text
        variant="titleMedium"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'center' }}
      >
        {title}
      </Text>
      <IconButton icon="chevron-right" label={t(NEXT[view])} onPress={onNext} />
      <Button label={t('Today')} variant="tonal" onPress={onToday} />
    </View>
  );
}
