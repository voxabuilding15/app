import { View } from 'react-native';

import {
  BarChart,
  Card,
  Text,
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_LABELS,
  type BarDatum,
} from '@/components';
import { weekdayOfKey } from '@/core';
import { spacing } from '@/theme';

import type { Habit } from '../../domain/entities';
import type { HabitStats, UnitProgress } from '../../domain/progress';
import { formatDay, shortMonth } from '../format';

const RECENT_TITLE = {
  daily: 'Last 7 days',
  weekly: 'Last 8 weeks',
  monthly: 'Last 6 months',
} as const;

function recentLabel(unit: UnitProgress, period: Habit['period']): string {
  switch (period) {
    case 'daily':
      return (WEEKDAY_LABELS[weekdayOfKey(unit.start)] ?? '').slice(0, 2);
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
  const recent: BarDatum[] = stats.recent.map((unit, index) => ({
    label: recentLabel(unit, habit.period),
    value: unit.done,
    highlight: index === stats.recent.length - 1,
    description: `${formatDay(unit.start)}: ${unit.done} of ${unit.goal}`,
  }));
  const weekdays: BarDatum[] = WEEKDAY_DISPLAY_ORDER.map((day) => ({
    label: (WEEKDAY_LABELS[day] ?? '').slice(0, 2),
    value: stats.weekdayCounts[day] ?? 0,
  }));
  const hasHistory = stats.totalCompletions > 0;

  return (
    <Card style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {RECENT_TITLE[habit.period]}
        </Text>
        <BarChart
          data={recent}
          color={habit.color}
          goal={habit.goalCount}
          label={`${RECENT_TITLE[habit.period]} against a goal of ${habit.goalCount}`}
        />
      </View>
      {hasHistory ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            By weekday
          </Text>
          <BarChart data={weekdays} color={habit.color} label="Completions by weekday" />
        </View>
      ) : null}
    </Card>
  );
}
