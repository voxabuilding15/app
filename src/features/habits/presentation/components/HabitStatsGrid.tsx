import { View } from 'react-native';

import { StatTile } from '@/components';
import { spacing } from '@/theme';
import { useTranslator } from '@/i18n';

import type { HabitPeriod } from '../../domain/entities';
import type { HabitStats } from '../../domain/progress';
import { describeStreak } from '../format';
import { msg } from '@/i18n/msg';
import { translatedLabels } from '@/i18n/labels';

const RATE_WINDOW: Record<HabitPeriod, string> = translatedLabels({
  daily: msg('last 30 days'),
  weekly: msg('last 12 weeks'),
  monthly: msg('last 12 months'),
});

interface HabitStatsGridProps {
  stats: HabitStats;
  period: HabitPeriod;
  accent: string;
}

export function HabitStatsGrid({ stats, period, accent }: HabitStatsGridProps) {
  const { t, tn } = useTranslator();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      <StatTile
        icon="local-fire-department"
        accent={accent}
        label={t('Current streak')}
        value={describeStreak(stats.currentStreak, period)}
      />
      <StatTile
        icon="emoji-events"
        accent={accent}
        label={t('Best streak')}
        value={describeStreak(stats.bestStreak, period)}
      />
      <StatTile
        icon="check-circle"
        accent={accent}
        label={t('Total completions')}
        value={String(stats.totalCompletions)}
        caption={tn(stats.activeDays, '{count} active day', '{count} active days')}
      />
      <StatTile
        icon="percent"
        accent={accent}
        label={t('Success rate')}
        value={stats.successRate === null ? '–' : `${Math.round(stats.successRate * 100)}%`}
        caption={RATE_WINDOW[period]}
      />
    </View>
  );
}
