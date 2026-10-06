import { View } from 'react-native';

import { BarChart, Card, Text, WEEKDAY_DISPLAY_ORDER, type BarDatum } from '@/components';
import { weekdayOfKey } from '@/core';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { Habit } from '../../domain/entities';
import type { HabitStats, UnitProgress } from '../../domain/progress';
import { formatDay, shortMonth } from '../format';
import { weekdayName } from '@/i18n/formatting';
import { msg } from '@/i18n/msg';

const RECENT_TITLE = {
  daily: msg('Last 7 days'),
  weekly: msg('Last 8 weeks'),
  monthly: msg('Last 6 months'),
} as const;

const RECENT_LABEL = {
  daily: msg('Last 7 days against a goal of {goalCount}'),
  weekly: msg('Last 8 weeks against a goal of {goalCount}'),
  monthly: msg('Last 6 months against a goal of {goalCount}'),
} as const;

function recentLabel(unit: UnitProgress, period: Habit['period']): string {
  switch (period) {
    case 'daily':
      return weekdayName(weekdayOfKey(unit.start), 'narrow');
    case 'monthly':
      return shortMonth(unit.start);
    default:
      return String(Number(unit.start.slice(8)));
  }
}

interface HabitChartsCardProps {
  habit: Habit;
  stats: HabitStats;
}

export function HabitChartsCard({ habit, stats }: HabitChartsCardProps) {
  const { t } = useTranslator();
  const recent: BarDatum[] = stats.recent.map((unit, index) => ({
    label: recentLabel(unit, habit.period),
    value: unit.done,
    highlight: index === stats.recent.length - 1,
    description: `${formatDay(unit.start)}: ${unit.done} of ${unit.goal}`,
  }));
  const weekdays: BarDatum[] = WEEKDAY_DISPLAY_ORDER.map((day) => ({
    label: weekdayName(day, 'narrow'),
    value: stats.weekdayCounts[day] ?? 0,
  }));
  const hasHistory = stats.totalCompletions > 0;

  return (
    <Card style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {t(RECENT_TITLE[habit.period])}
        </Text>
        <BarChart
          data={recent}
          color={habit.color}
          goal={habit.goalCount}
          label={t(RECENT_LABEL[habit.period], { goalCount: habit.goalCount })}
        />
      </View>
      {hasHistory ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('By weekday')}
          </Text>
          <BarChart data={weekdays} color={habit.color} label={t('Completions by weekday')} />
        </View>
      ) : null}
    </Card>
  );
}
