import { View } from 'react-native';

import { Card, ProgressBar, ProgressRing, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import type { StatsReport } from '../../domain/usecases';

function delta(current: number | null, previous: number | null): string | null {
  if (current === null || previous === null) {
    return null;
  }
  const change = current - previous;
  return change === 0 ? '±0' : change > 0 ? `+${change}` : String(change);
}

interface ScoreLineProps {
  label: string;
  value: number | null;
  previous: number | null;
  suffix?: string;
}

function ScoreLine({ label, value, previous, suffix = '' }: ScoreLineProps) {
  const { t } = useTranslator();
  const change = delta(value, previous);
  const spoken =
    value === null
      ? `${label}: ${t('no data yet')}`
      : `${label}: ${value}${suffix}${change === null ? '' : `, ${change} ${t('compared with the previous period')}`}`;
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{ gap: spacing.xs, minWidth: 150, flex: 1 }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="labelLarge">{label}</Text>
        <Text variant="labelLarge" tone="primary">
          {value === null ? '–' : `${value}${suffix}`}
          {change === null ? '' : `  ${change}`}
        </Text>
      </View>
      {/* The line above already speaks the value, so the bar is only decoration. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <ProgressBar progress={(value ?? 0) / 100} label={label} height={6} />
      </View>
    </View>
  );
}

/** The productivity score as a ring, with the three scores it is made of. */
export function ScoresCard({ report }: { report: StatsReport }) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { scores } = report.current;
  const before = report.previous.scores;
  const change = delta(scores.productivity, before.productivity);

  return (
    <Card style={{ gap: spacing.lg }}>
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xl }}
      >
        <ProgressRing
          progress={(scores.productivity ?? 0) / 100}
          size={132}
          strokeWidth={12}
          color={colors.primary}
          label={
            scores.productivity === null
              ? `${t('Productivity score')}: ${t('no data yet')}`
              : `${t('Productivity score')}: ${scores.productivity} ${t('out of 100')}`
          }
        >
          <Text variant="headlineSmall">{scores.productivity ?? '–'}</Text>
          <Text variant="labelSmall" tone="muted">
            {change ?? t('Productivity')}
          </Text>
        </ProgressRing>
        <View style={{ flex: 1, minWidth: 200, gap: spacing.md }}>
          <ScoreLine label={t('Focus score')} value={scores.focus} previous={before.focus} />
          <ScoreLine
            label={t('Habit consistency')}
            value={scores.habits}
            previous={before.habits}
            suffix="%"
          />
          <ScoreLine
            label={t('Task completion rate')}
            value={scores.tasks}
            previous={before.tasks}
            suffix="%"
          />
        </View>
      </View>
      <Text variant="labelSmall" tone="muted">
        {t(
          'The productivity score blends task completion, habit consistency and focus. Parts without data are left out.',
        )}
      </Text>
    </Card>
  );
}
