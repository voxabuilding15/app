import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { AchievementState } from '../domain/usecases';

import { useAchievementsModule } from './module';

export const ACHIEVEMENTS_KEY = ['achievements', 'state'] as const;

/** Checks for new unlocks as it loads, so the screen is always up to date when it opens. */
export function useAchievementState(): UseQueryResult<AchievementState> {
  const { achievements } = useAchievementsModule();
  return useQuery({
    queryKey: ACHIEVEMENTS_KEY,
    queryFn: () => achievements.sync(),
    staleTime: 0,
  });
}

export function useSetAchievementState(): (state: AchievementState) => void {
  const client = useQueryClient();
  return useCallback((state) => client.setQueryData(ACHIEVEMENTS_KEY, state), [client]);
}
