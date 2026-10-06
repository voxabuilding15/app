import { View } from 'react-native';

import { Card, Icon, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { STREAK_BADGES } from '../../domain/catalog';
import type { AchievementState } from '../../domain/usecases';

/** The current daily streak and the next reward on the way. */
export function StreakCard({ state }: { state: AchievementState }) {
  const { t, tn } = useTranslator();
  const { colors } = useTheme();
  const { current, longest } = state.streak;
  const next = STREAK_BADGES.find((def) => (def.target ?? 0) > current);
  const untilNext = next === undefined ? 0 : (next.target ?? 0) - current;

  return (
    <Card>
      <View
        accessible
        accessibilityLabel={`${t('Daily streak')}: ${tn(current, '{count} day', '{count} days')}. ${t('Best')}: ${tn(longest, '{count} day', '{count} days')}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}
      >
        <Icon
          name="local-fire-department"
          size={40}
          color={current > 0 ? colors.warning : colors.outline}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="titleMedium">
            {tn(current, '{count} day streak', '{count} days streak')}
          </Text>
          <Text variant="labelSmall" tone="muted">
            {`${t('Best')}: ${tn(longest, '{count} day', '{count} days')}`}
          </Text>
          {next === undefined ? null : (
            <Text variant="labelSmall" tone="muted">
              {t('{days} more days for +{xp} XP', { days: untilNext, xp: next.xp })}
            </Text>
          )}
        </View>
      </View>
    </Card>
  );
}
