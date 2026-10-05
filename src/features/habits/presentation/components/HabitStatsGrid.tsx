import { View } from 'react-native';

import { StatTile } from '@/components';
import { spacing } from '@/theme';

import type { HabitPeriod } from '../../domain/entities';
import type { HabitStats } from '../../domain/progress';
import { describeStreak } from '../format';

const RATE_WINDOW: Record<HabitPeriod, string> = {
  daily: 'last 30 days',
  weekly: 'last 12 weeks',
  monthly: 'last 12 months',
};

interface HabitStatsGridProps {
  stats: HabitStats;
  period: HabitPeriod;
  accent: string;
}

export function HabitStatsGrid({ stats, period, accent }: HabitStatsGridProps) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      <StatTile
        icon="local-fire-department"
        accent={accent}
        label="Current streak"
        value={describeStreak(stats.currentStreak, period)}
      />
      <StatTile
        icon="emoji-events"
        accent={accent}
        label="Best streak"
        value={describeStreak(stats.bestStreak, period)}
      />
      <StatTile
        icon="check-circle"
        accent={accent}
        label="Total completions"
        value={String(stats.totalCompletions)}
        caption={`${stats.activeDays} active ${stats.activeDays === 1 ? 'day' : 'days'}`}
      />
      <StatTile
        icon="percent"
        accent={accent}
        label="Success rate"
        value={stats.successRate === null ? '–' : `${Math.round(stats.successRate * 100)}%`}
        caption={RATE_WINDOW[period]}
      />
    </View>
  );
}
