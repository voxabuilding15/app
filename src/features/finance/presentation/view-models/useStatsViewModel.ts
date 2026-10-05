import { useState } from 'react';

import type { Breakdown, StatsMonths } from '../../domain/stats-usecases';
import { useFinanceStats } from '../queries';

export function useStatsViewModel() {
  const [months, setMonths] = useState<StatsMonths>(6);
  const [breakdown, setBreakdown] = useState<Breakdown>('expense');
  const query = useFinanceStats(months, breakdown);

  return {
    months,
    setMonths,
    breakdown,
    setBreakdown,
    stats: query.data,
    isLoading: query.isPending,
    isError: query.isError,
    isRefreshing: query.isRefetching,
    refetch: query.refetch,
  };
}
