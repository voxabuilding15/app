import { View } from 'react-native';

import { Card, PressableScale, ProgressBar, ProgressRing, Text } from '@/components';
import { useTranslator } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { levelTitle } from '../../domain/levels';
import { useAchievementState } from '../queries';

interface LevelProgressCardProps {
  /** Makes the card a button, e.g. to open the achievements. */
  onPress?: () => void;
}

/** The level, its rank and the XP to the next level. Loads its own data, so it can sit anywhere. */
export function LevelProgressCard({ onPress }: LevelProgressCardProps) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { data } = useAchievementState();
  if (data === undefined) {
    return null;
  }
  const { level, xp } = data;
  const toNext = level.span === 0 ? 0 : level.span - level.into;
  const summary = `${t('Level {level}', { level: level.level })}, ${t(levelTitle(level.level))}, ${xp} XP`;

  const body = (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <ProgressRing
        progress={level.fraction}
        size={84}
        strokeWidth={8}
        color={colors.primary}
        label={`${summary}. ${level.span === 0 ? t('Top level reached') : t('{xp} XP to the next level', { xp: toNext })}`}
      >
        <Text variant="labelSmall" tone="muted">
          {t('Level')}
        </Text>
        <Text variant="titleLarge">{level.level}</Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="titleMedium">{t(levelTitle(level.level))}</Text>
        <Text tone="muted">{`${xp} XP`}</Text>
        <ProgressBar progress={level.fraction} label={t('Progress to the next level')} />
        <Text variant="labelSmall" tone="muted">
          {level.span === 0
            ? t('Top level reached')
            : t('{xp} XP to the next level', { xp: toNext })}
        </Text>
      </View>
    </Card>
  );
  return onPress === undefined ? (
    body
  ) : (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${summary}. ${t('Open achievements')}`}
      pressedScale={0.99}
      onPress={onPress}
    >
      {/* The button's own label already says all of this. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {body}
      </View>
    </PressableScale>
  );
}
