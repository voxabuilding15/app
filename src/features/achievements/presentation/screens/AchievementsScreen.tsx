import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, ScreenToolbar, SegmentedControl, StatTile, Text } from '@/components';
import { useIsTablet } from '@/hooks';
import { useTranslator } from '@/i18n';
import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';

import { BadgeGrid } from '../components/BadgeGrid';
import { ChallengeList } from '../components/ChallengeList';
import { LevelProgressCard } from '../components/LevelProgressCard';
import { StreakCard } from '../components/StreakCard';
import {
  useAchievementsViewModel,
  type AchievementsTab,
} from '../view-models/useAchievementsViewModel';

const WIDE_MAX_WIDTH = 1280;

/** XP, level, streak, challenges, badges and milestones. */
export function AchievementsScreen() {
  const vm = useAchievementsViewModel();
  const { t } = useTranslator();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isTablet = useIsTablet();
  const { state } = vm;

  const tabs: readonly { value: AchievementsTab; label: string }[] = [
    { value: 'challenges', label: t('Challenges') },
    { value: 'badges', label: t('Badges') },
    { value: 'milestones', label: t('Milestones') },
  ];

  const summary =
    state === undefined ? null : (
      <View style={{ gap: spacing.lg }}>
        <LevelProgressCard />
        <StreakCard state={state} />
        <Card style={{ gap: spacing.md }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('Your statistics')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            <StatTile
              icon="check-circle"
              label={t('Tasks done')}
              value={String(state.lifetime.tasks)}
            />
            <StatTile
              icon="local-fire-department"
              label={t('Habit check-ins')}
              value={String(state.lifetime.checkIns)}
            />
            <StatTile
              icon="timer"
              label={t('Focus time')}
              value={`${Math.floor(state.lifetime.focusMinutes / 60)}h ${state.lifetime.focusMinutes % 60}m`}
            />
          </View>
          <Text variant="labelSmall" tone="muted">
            {t('{unlocked} of {total} achievements unlocked', {
              unlocked: vm.unlockedCount,
              total: vm.totalCount,
            })}
          </Text>
          <Button
            label={t('Open statistics')}
            variant="tonal"
            onPress={() => router.navigate('/statistics')}
          />
        </Card>
      </View>
    );

  const content =
    state === undefined ? null : vm.tab === 'challenges' ? (
      <View style={{ gap: spacing.lg }}>
        <ChallengeList period="week" challenges={state.challenges.week} />
        <ChallengeList period="month" challenges={state.challenges.month} />
      </View>
    ) : vm.tab === 'badges' ? (
      <BadgeGrid items={vm.badges} />
    ) : (
      <BadgeGrid items={vm.milestones} />
    );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Achievements')} />
      <ScrollView
        contentContainerStyle={{
          gap: spacing.lg,
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          width: '100%',
          maxWidth: isTablet ? WIDE_MAX_WIDTH : CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
      >
        {vm.isError && state === undefined ? (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <Text tone="error">{t("Couldn't load your achievements.")}</Text>
            <Button label={t('Try again')} variant="tonal" onPress={() => void vm.refetch()} />
          </View>
        ) : isTablet ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ width: 380 }}>{summary}</View>
            <View style={{ flex: 1, gap: spacing.lg }}>
              <SegmentedControl options={tabs} value={vm.tab} onChange={vm.setTab} />
              {content}
            </View>
          </View>
        ) : (
          <>
            {summary}
            <SegmentedControl options={tabs} value={vm.tab} onChange={vm.setTab} />
            {content}
          </>
        )}
        {state === undefined ? null : (
          <Text variant="labelSmall" tone="muted" style={{ textAlign: 'center' }}>
            {t('{xp} XP in total', { xp: state.xp })}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
