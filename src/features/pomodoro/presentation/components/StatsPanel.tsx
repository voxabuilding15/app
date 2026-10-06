import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import {
  BarChart,
  Button,
  Card,
  EmptyState,
  Heatmap,
  ProgressRing,
  SegmentedControl,
  StatTile,
  Text,
  fitHeatmap,
} from '@/components';
import { spacing, useTheme, withAlpha } from '@/theme';
import { useTranslator } from '@/i18n';

import type { StatsPeriod } from '../../domain/stats';
import type { GoalProgress } from '../../domain/stats-usecases';
import {
  formatBucketDescription,
  formatBucketLabel,
  formatDayLabel,
  formatFocusTime,
} from '../format';
import { HEATMAP_ROW_LABELS, buildHeatmapModel } from '../heatmap-model';
import type { StatsViewModel } from '../view-models/useStatsViewModel';
import { msg } from '@/i18n/msg';

const PERIODS = [
  { value: 'day', label: msg('Day') },
  { value: 'week', label: msg('Week') },
  { value: 'month', label: msg('Month') },
] as const satisfies readonly { value: StatsPeriod; label: string }[];

const FOCUS_PER = {
  day: msg('Focus minutes per day'),
  week: msg('Focus minutes per week'),
  month: msg('Focus minutes per month'),
} as const;

const HEAT_GAP = 3;
const HEAT_ROW_LABEL_SPACE = 16 + HEAT_GAP;
const HEAT_WEEKS = 26;
const LEVELS = [0, 0.3, 0.5, 0.75, 1] as const;

function GoalRing({ title, progress }: { title: string; progress: GoalProgress }) {
  const { t } = useTranslator();
  const fraction = progress.fraction;
  const detail =
    fraction === null
      ? t('No goal')
      : t('{done} of {goal}', {
          done: formatFocusTime(progress.focusSeconds),
          goal: formatFocusTime(progress.goalMinutes * 60),
        });
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 96 }}>
      <ProgressRing
        progress={fraction ?? 0}
        size={84}
        strokeWidth={8}
        label={
          fraction === null
            ? t('{title}: {focusTime} focused, no goal set', {
                title,
                focusTime: formatFocusTime(progress.focusSeconds),
              })
            : t('{title}: {percent} percent of the goal, {detail}', {
                title,
                percent: Math.round(fraction * 100),
                detail,
              })
        }
      >
        <Text variant="labelLarge">
          {fraction === null ? '–' : `${Math.round(fraction * 100)}%`}
        </Text>
      </ProgressRing>
      <Text variant="labelLarge">{title}</Text>
      <Text variant="labelSmall" tone="muted" style={{ textAlign: 'center' }}>
        {detail}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="titleMedium" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

/** Goals, streak, deep focus, focus time per day, week and month, and the heatmap. */
export function StatsPanel({ vm }: { vm: StatsViewModel }) {
  const { t, tn } = useTranslator();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const { overview } = vm;

  if (vm.isError && overview === undefined) {
    return (
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <Text tone="error">{t("Couldn't load your statistics.")}</Text>
        <Button label={t('Try again')} variant="tonal" onPress={() => void vm.refetch()} />
      </View>
    );
  }
  if (overview === undefined) {
    return null;
  }
  if (overview.series.month.every((point) => point.focusSeconds === 0)) {
    return (
      <EmptyState
        icon="insights"
        title={t('No focus time yet')}
        message={t('Complete a focus session and your goals, streak and heatmap will appear here.')}
      />
    );
  }

  const series = overview.series[vm.period];
  const { columns: weeks, cellSize } = fitHeatmap(width, {
    gap: HEAT_GAP,
    reserved: HEAT_ROW_LABEL_SPACE,
    maxColumns: HEAT_WEEKS,
    minCell: 12,
    maxCell: 20,
  });
  const heat = buildHeatmapModel(overview.heatmap, weeks);

  return (
    <View style={{ gap: spacing.lg }}>
      <Section title={t('Goals')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <GoalRing title={t('Today')} progress={overview.today} />
          <GoalRing title={t('This week')} progress={overview.week} />
          <GoalRing title={t('This month')} progress={overview.month} />
        </View>
      </Section>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <StatTile
          icon="local-fire-department"
          label={t('Current streak')}
          value={tn(overview.streak.current, '{count} day', '{count} days')}
          caption={tn(overview.streak.longest, 'Best: {count} day', 'Best: {count} days')}
        />
        <StatTile
          icon="psychology"
          label={t('Deep focus')}
          value={overview.deepFocus === null ? '–' : `${overview.deepFocus}`}
          caption={t('Average, last 30 days')}
        />
        <StatTile
          icon="check-circle"
          label={t('Sessions today')}
          value={String(overview.today.completed)}
          caption={formatFocusTime(overview.today.focusSeconds)}
        />
      </View>

      <Section title={t('Focus time')}>
        <SegmentedControl options={PERIODS} value={vm.period} onChange={vm.setPeriod} />
        <BarChart
          label={t(FOCUS_PER[vm.period])}
          goal={vm.goalMinutes > 0 ? vm.goalMinutes : undefined}
          data={series.map((point, index) => ({
            label: formatBucketLabel(vm.period, point.from),
            value: Math.round(point.focusSeconds / 60),
            highlight: index === series.length - 1,
            description: `${formatBucketDescription(vm.period, point.from, point.to)}: ${formatFocusTime(point.focusSeconds)}, ${tn(point.completed, '{count} session', '{count} sessions')}`,
          }))}
        />
      </Section>

      <Section title={t('Heatmap')}>
        <View
          testID="pomodoro-heatmap"
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        >
          {width > 0 ? (
            <Heatmap
              columns={heat.columns}
              columnLabels={heat.columnLabels}
              rowLabels={HEATMAP_ROW_LABELS}
              color={colors.primary}
              cellSize={cellSize}
              gap={HEAT_GAP}
              selectedKey={vm.selected?.date ?? null}
              onPressCell={vm.selectDay}
              label={t('Focus time over the last {weeks} weeks', { weeks })}
            />
          ) : null}
        </View>
        <View accessibilityLiveRegion="polite">
          <Text variant="labelLarge">
            {vm.selected
              ? `${formatDayLabel(vm.selected.date)}: ${
                  vm.selected.focusSeconds > 0
                    ? formatFocusTime(vm.selected.focusSeconds)
                    : t('no focus')
                }`
              : t('Tap a day for details')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="labelSmall" tone="muted">
            {t('Less')}
          </Text>
          {LEVELS.map((alpha) => (
            <View
              key={alpha}
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor:
                  alpha === 0 ? colors.outlineVariant : withAlpha(colors.primary, alpha),
              }}
            />
          ))}
          <Text variant="labelSmall" tone="muted">
            {t('More · relative to your daily goal')}
          </Text>
        </View>
      </Section>

      {overview.links.length > 0 ? (
        <Section title={t('Where the time went')}>
          {overview.links.map((link) => (
            <View
              key={`${link.kind}-${link.id}`}
              accessible
              accessibilityLabel={t('{kind} {title}: {time}', {
                kind: link.kind === 'task' ? t('Task') : t('Habit'),
                title: link.title,
                time: formatFocusTime(link.seconds),
              })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <Text variant="bodyLarge" style={{ flex: 1 }} numberOfLines={1}>
                {link.title}
              </Text>
              <Text variant="bodyLarge" tone="muted">
                {formatFocusTime(link.seconds)}
              </Text>
            </View>
          ))}
          <Text variant="labelSmall" tone="muted">
            {t('Last 30 days, by linked task and habit')}
          </Text>
        </Section>
      ) : null}
    </View>
  );
}
