import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { DateKey } from '@/core';

import type { StatsPeriod } from '../domain/range';
import type { StatsReport } from '../domain/usecases';

import { useStatisticsModule } from './module';

const STATISTICS_ROOT = ['statistics'] as const;

export function useReport(period: StatsPeriod, anchor: DateKey): UseQueryResult<StatsReport> {
  const { stats } = useStatisticsModule();
  return useQuery({
    queryKey: [...STATISTICS_ROOT, 'report', period, anchor],
    queryFn: () => stats.report(period, anchor),
    // Figures change whenever any feature is used, so always look again when the screen opens.
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
