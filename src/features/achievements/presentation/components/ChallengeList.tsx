import { View } from 'react-native';

import { Card, Icon, ProgressBar, Text } from '@/components';
import { dateKeyToNoon } from '@/core';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { periodEnd, type Challenge, type ChallengePeriod } from '../../domain/challenges';

interface ChallengeListProps {
  period: ChallengePeriod;
  challenges: readonly Challenge[];
}

/** The challenges of this week or month, each with its progress and reward. */
export function ChallengeList({ period, challenges }: ChallengeListProps) {
  const { t, locale } = useTranslator();
  const { colors } = useTheme();
  const first = challenges[0];
  if (first === undefined) {
    return null;
  }
  const ends = new Date(dateKeyToNoon(periodEnd(period, first.periodKey))).toLocaleDateString(
    locale,
    {
      day: 'numeric',
      month: 'long',
    },
  );

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="titleMedium" accessibilityRole="header">
          {period === 'week' ? t('Weekly challenges') : t('Monthly challenges')}
        </Text>
        <Text variant="labelSmall" tone="muted">
          {t('Ends {date}', { date: ends })}
        </Text>
      </View>
      {challenges.map((challenge) => {
        const title = t(challenge.template.title, { count: challenge.target });
        const shown = Math.min(challenge.progress, challenge.target);
        return (
          <View
            key={challenge.key}
            accessible
            accessibilityLabel={`${title}. ${
              challenge.done
                ? t('Completed')
                : t('{done} of {target}', { done: shown, target: challenge.target })
            }. +${challenge.xp} XP`}
            style={{ gap: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {challenge.done ? (
                <Icon name="check-circle" size={20} color={colors.success} />
              ) : null}
              <Text style={{ flex: 1 }}>{title}</Text>
              <Text variant="labelLarge" tone="primary">{`+${challenge.xp} XP`}</Text>
            </View>
            <ProgressBar
              progress={shown / challenge.target}
              label={title}
              color={challenge.done ? colors.success : undefined}
            />
            <Text variant="labelSmall" tone="muted">
              {t('{done} of {target}', { done: shown, target: challenge.target })}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}
