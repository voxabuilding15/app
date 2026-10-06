import { View } from 'react-native';

import { Icon, ProgressBar, Text, type IconName } from '@/components';
import { useTranslator } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import type { AchievementView } from '../../domain/usecases';
import { TIER_COLORS } from '../tiers';

const TILE_MIN_WIDTH = 150;

function BadgeTile({ item }: { item: AchievementView }) {
  const { t, locale } = useTranslator();
  const { colors } = useTheme();
  const { def } = item;
  const accent = def.tier === undefined ? colors.primary : TIER_COLORS[def.tier];
  const title = t(def.title, { count: def.count });
  const description = t(def.description, { count: def.count });
  const when =
    item.unlockedAt === null
      ? null
      : new Date(item.unlockedAt).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
  const progress = item.progress;

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${description}. ${
        item.unlocked
          ? `${t('Unlocked')} ${when ?? ''}`
          : progress === null
            ? t('Locked')
            : `${t('Locked')}, ${t('{done} of {target}', { done: progress.current, target: progress.target })}`
      }. +${def.xp} XP`}
      style={{
        flexGrow: 1,
        flexBasis: TILE_MIN_WIDTH,
        minWidth: TILE_MIN_WIDTH,
        gap: spacing.xs,
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceContainer,
        opacity: item.unlocked ? 1 : 0.8,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: item.unlocked ? accent : colors.outlineVariant,
        }}
      >
        <Icon
          name={(item.unlocked ? def.icon : 'lock') as IconName}
          size={30}
          color={item.unlocked ? '#FFFFFF' : colors.onSurfaceVariant}
        />
      </View>
      <Text variant="labelLarge" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="labelSmall" tone="muted" style={{ textAlign: 'center' }}>
        {description}
      </Text>
      {!item.unlocked && progress !== null ? (
        <View style={{ alignSelf: 'stretch' }}>
          <ProgressBar progress={progress.current / progress.target} label={title} height={6} />
        </View>
      ) : null}
      <Text variant="labelSmall" tone={item.unlocked ? 'success' : 'muted'}>
        {item.unlocked ? (when ?? '') : `+${def.xp} XP`}
      </Text>
    </View>
  );
}

/** Badges as a wrapping grid of tiles: earned ones in color, the rest locked with their progress. */
export function BadgeGrid({ items }: { items: readonly AchievementView[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((item) => (
        <BadgeTile key={`${item.def.group}:${item.def.id}`} item={item} />
      ))}
    </View>
  );
}
