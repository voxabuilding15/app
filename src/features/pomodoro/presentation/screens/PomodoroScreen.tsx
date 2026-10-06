import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, SegmentedControl, Snackbar, ScreenToolbar } from '@/components';
import { useIsTablet } from '@/hooks';
import { CONTENT_MAX_WIDTH, spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { HistoryPanel } from '../components/HistoryPanel';
import { StatsPanel } from '../components/StatsPanel';
import { TimerCard } from '../components/TimerCard';
import { TimerLinksCard } from '../components/TimerLinksCard';
import { TodayGoal } from '../components/TodayGoal';
import { useHistoryViewModel } from '../view-models/useHistoryViewModel';
import { useStatsViewModel } from '../view-models/useStatsViewModel';
import { useTimerViewModel } from '../view-models/useTimerViewModel';
import { msg } from '@/i18n/msg';

type Section = 'timer' | 'stats' | 'history';

const PHONE_SECTIONS = [
  { value: 'timer', label: msg('Timer') },
  { value: 'stats', label: msg('Stats') },
  { value: 'history', label: msg('History') },
] as const;
const TABLET_SECTIONS = PHONE_SECTIONS.filter((section) => section.value !== 'timer');

const TABLET_TIMER_WIDTH = 420;

/**
 * The Pomodoro home: the timer, statistics and history. Phones switch between them; tablets keep
 * the timer on the left and show statistics or history beside it.
 */
export function PomodoroScreen() {
  const { t } = useTranslator();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const isTablet = useIsTablet();
  const [section, setSection] = useState<Section>('timer');
  const timer = useTimerViewModel();
  const stats = useStatsViewModel();
  const history = useHistoryViewModel();

  const active: Section = isTablet && section === 'timer' ? 'stats' : section;
  const notice = timer.notice ?? history.notice;
  const dismissNotice = timer.notice ? timer.dismissNotice : history.dismissNotice;

  const timerColumn = (
    <>
      <TimerCard vm={timer} />
      <TodayGoal />
      <TimerLinksCard vm={timer} />
    </>
  );
  const panel = active === 'stats' ? <StatsPanel vm={stats} /> : <HistoryPanel vm={history} />;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
      <ScreenToolbar title={t('Pomodoro')}>
        <IconButton
          icon="settings"
          label={t('Pomodoro settings')}
          onPress={() => router.push('/pomodoro/settings')}
        />
      </ScreenToolbar>

      {isTablet ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.lg, padding: spacing.lg }}>
          <ScrollView
            style={{ width: TABLET_TIMER_WIDTH, flexGrow: 0 }}
            contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}
          >
            {timerColumn}
          </ScrollView>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}
          >
            <SegmentedControl options={TABLET_SECTIONS} value={active} onChange={setSection} />
            {panel}
          </ScrollView>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            gap: spacing.lg,
            padding: spacing.lg,
            paddingBottom: spacing.xxl,
            maxWidth: CONTENT_MAX_WIDTH,
            width: '100%',
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <SegmentedControl options={PHONE_SECTIONS} value={active} onChange={setSection} />
          {active === 'timer' ? timerColumn : panel}
        </ScrollView>
      )}

      {notice ? (
        <Snackbar
          message={notice.message}
          actionLabel={notice.actionLabel}
          onAction={notice.onAction}
          onDismiss={dismissNotice}
        />
      ) : null}
    </View>
  );
}
