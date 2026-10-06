import { useMemo, useState } from 'react';

import type { StatsPeriod } from '../../domain/stats';
import { useOverview, usePomodoroSettings } from '../queries';

export function useStatsViewModel() {
  const settings = usePomodoroSettings();
  const query = useOverview(settings);
  const [period, setPeriod] = useState<StatsPeriod>('day');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const overview = query.data;
  const selected = useMemo(
    () => overview?.heatmap.find((day) => day.date === selectedDay) ?? null,
    [overview, selectedDay],
  );
  const goalMinutes: Record<StatsPeriod, number> = {
    day: settings.dailyGoalMinutes,
    week: settings.weeklyGoalMinutes,
    month: settings.monthlyGoalMinutes,
  };

  return {
    overview,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    period,
    setPeriod,
    /** The goal that applies to a bar in the chart for the chosen period; 0 when it is off. */
    goalMinutes: goalMinutes[period],
    dailyGoalMinutes: settings.dailyGoalMinutes,
    selected,
    selectDay: setSelectedDay,
  };
}

export type StatsViewModel = ReturnType<typeof useStatsViewModel>;
