import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Screen, Text } from '@/components';
import { formatMoney, toDateKey, useContainer } from '@/core';
import { LevelProgressCard } from '@/features/achievements';
import { formatMinutes } from '@/features/statistics/domain/summary';
import { useReport } from '@/features/statistics/presentation/queries';
import { useNow } from '@/hooks';
import { useTranslator } from '@/i18n';
import { spacing } from '@/theme';

import { QuickActions } from './components/QuickActions';
import { TodayCard } from './components/TodayCard';

/** What today looks like across the app, taken from the same figures as the statistics. */
export function DashboardScreen() {
  const { t, tn, locale } = useTranslator();
  const router = useRouter();
  const { clock } = useContainer();
  const now = useNow();
  const { data } = useReport('day', toDateKey(clock.now()));

  const date = new Date(now);
  const hour = date.getHours();
  const greeting =
    hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening');
  const dateLabel = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const today = data?.current;
  const habitScore = today?.scores.habits;

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="headlineSmall" accessibilityRole="header">
          {greeting}
        </Text>
        <Text tone="muted">{dateLabel}</Text>
      </View>
      <LevelProgressCard onPress={() => router.navigate('/achievements')} />
      <QuickActions />
      {data === undefined || today === undefined ? null : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <TodayCard
            title={t('Tasks')}
            icon="check-circle"
            value={tn(today.tasks.completed, '{count} done', '{count} done')}
            caption={
              today.tasks.overdue > 0
                ? tn(today.tasks.overdue, '{count} overdue', '{count} overdue')
                : t('Nothing overdue')
            }
            onPress={() => router.navigate('/tasks')}
          />
          <TodayCard
            title={t('Habits')}
            icon="local-fire-department"
            value={habitScore === null || habitScore === undefined ? '–' : `${habitScore}%`}
            caption={tn(
              today.habits.completions,
              '{count} check-in today',
              '{count} check-ins today',
            )}
            onPress={() => router.navigate('/habits')}
          />
          <TodayCard
            title={t('Focus')}
            icon="timer"
            value={formatMinutes(today.focus.seconds / 60)}
            caption={tn(today.focus.sessions, '{count} session', '{count} sessions')}
            onPress={() => router.navigate('/pomodoro')}
          />
          <TodayCard
            title={t('Spending')}
            icon="payments"
            value={formatMoney(data.finance.expenseMinor, data.currency)}
            caption={
              data.finance.incomeMinor > 0
                ? `${t('Income')} ${formatMoney(data.finance.incomeMinor, data.currency)}`
                : t('No income today')
            }
            onPress={() => router.navigate('/finance')}
          />
          <TodayCard
            title={t('Calendar')}
            icon="event"
            value={tn(today.calendar.events, '{count} event', '{count} events')}
            caption={t('Scheduled today')}
            onPress={() => router.navigate('/calendar')}
          />
          <TodayCard
            title={t('Productivity score')}
            icon="insights"
            value={today.scores.productivity === null ? '–' : String(today.scores.productivity)}
            caption={t('See all statistics')}
            onPress={() => router.navigate('/statistics')}
          />
        </View>
      )}
    </Screen>
  );
}
