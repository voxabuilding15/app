import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';

import { Card, EmptyState, IconButton, Screen, Snackbar, Text } from '@/components';
import { spacing, useTheme } from '@/theme';
import { useTranslator } from '@/i18n';

import { DaySheet } from '../components/DaySheet';
import { HabitChartsCard } from '../components/HabitChartsCard';
import { HabitHeatmapCard } from '../components/HabitHeatmapCard';
import { HabitIconBubble } from '../components/HabitIconBubble';
import { HabitProgressCard } from '../components/HabitProgressCard';
import { HabitStatsGrid } from '../components/HabitStatsGrid';
import { describeFrequency, describeGoal, formatReminderTime } from '../format';
import { useHabitDetailViewModel } from '../view-models/useHabitDetailViewModel';

const WIDE_MIN_WIDTH = 900;
const WIDE_MAX_WIDTH = 1100;

export function HabitDetailScreen({ habitId }: { habitId: string }) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const vm = useHabitDetailViewModel(habitId);
  const { data, evaluator } = vm;
  const wide = width >= WIDE_MIN_WIDTH;

  if (vm.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('Habit') }} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel={t('Loading habit')}
          />
        </View>
      </>
    );
  }
  if (vm.isError || vm.notFound || data === null || evaluator === null) {
    return (
      <>
        <Stack.Screen options={{ title: t('Habit') }} />
        <Screen>
          <EmptyState
            icon="error-outline"
            title={vm.notFound ? t('Habit not found') : t("Couldn't load the habit")}
            message={
              vm.notFound
                ? t('This habit may have been deleted.')
                : t('Your data is safe on this device. Try again.')
            }
            actionLabel={vm.notFound ? undefined : t('Try again')}
            onAction={vm.notFound ? undefined : vm.retry}
          />
        </Screen>
      </>
    );
  }

  const { entry, summary, stats, today } = data;
  const { habit } = entry;
  const archived = habit.archivedAt !== null;

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <HabitIconBubble icon={habit.icon} color={habit.color} size={56} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {habit.name}
        </Text>
        <Text tone="muted">{`${describeFrequency(habit)} · ${describeGoal(habit)}`}</Text>
        <Text variant="labelSmall" tone="muted">
          {[
            habit.category?.name,
            habit.reminderTime
              ? t('Reminder {reminderTime}', {
                  reminderTime: formatReminderTime(habit.reminderTime),
                })
              : null,
            archived ? t('Archived') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </View>
  );

  const left = (
    <>
      <HabitProgressCard
        summary={summary}
        onAdjustToday={(delta) => void vm.adjustDay(today, delta)}
        onSkipToday={() => void vm.skipDay(today, !summary.skippedToday)}
        onTogglePause={() => void (habit.paused ? vm.resume() : vm.pause())}
      />
      {habit.notes ? (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="titleMedium" accessibilityRole="header">
            {t('Notes')}
          </Text>
          <Text>{habit.notes}</Text>
        </Card>
      ) : null}
      <HabitStatsGrid stats={stats} period={habit.period} accent={habit.color} />
    </>
  );
  const right = (
    <>
      <HabitHeatmapCard
        habit={habit}
        evaluator={evaluator}
        today={today}
        selectedDay={vm.selectedDay}
        onSelectDay={vm.selectDay}
      />
      <HabitChartsCard habit={habit} stats={stats} />
    </>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: habit.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="edit"
                label={t('Edit habit')}
                onPress={() =>
                  router.push({ pathname: '/habits/[id]/edit', params: { id: habit.id } })
                }
              />
              {archived ? (
                <IconButton
                  icon="unarchive"
                  label={t('Restore habit')}
                  onPress={() => void vm.restore()}
                />
              ) : (
                <IconButton
                  icon="archive"
                  label={t('Archive habit')}
                  onPress={() => void vm.archive()}
                />
              )}
              <IconButton icon="delete" label={t('Delete habit')} onPress={vm.confirmDelete} />
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Screen maxWidth={wide ? WIDE_MAX_WIDTH : undefined}>
          {header}
          {wide ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
              <View style={{ flex: 1, gap: spacing.lg }}>{left}</View>
              <View style={{ flex: 1, gap: spacing.lg }}>{right}</View>
            </View>
          ) : (
            <>
              {left}
              {right}
            </>
          )}
        </Screen>
        {vm.failure ? <Snackbar message={vm.failure} onDismiss={vm.dismissFailure} /> : null}
      </View>

      {vm.selectedDay ? (
        <DaySheet
          day={vm.selectedDay}
          today={today}
          habit={habit}
          evaluator={evaluator}
          onAdjust={(delta) => void vm.adjustDay(vm.selectedDay ?? today, delta)}
          onSkip={(skipped) => void vm.skipDay(vm.selectedDay ?? today, skipped)}
          onClose={() => vm.selectDay(null)}
        />
      ) : null}
    </>
  );
}
