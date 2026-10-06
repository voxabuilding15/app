import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { DataUsage } from '../domain/usage';

import { useSettingsModule } from './module';

const SETTINGS_ROOT = ['settings'] as const;

export function useUsage(): UseQueryResult<DataUsage> {
  const { usage } = useSettingsModule();
  return useQuery({
    queryKey: [...SETTINGS_ROOT, 'usage'],
    queryFn: () => usage.read(),
    staleTime: 0,
  });
}
